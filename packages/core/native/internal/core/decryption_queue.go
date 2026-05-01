package core

import (
	"context"
	"encoding/json"
	"sort"
	"time"

	"maunium.net/go/mautrix/event"
	"maunium.net/go/mautrix/id"
)

const (
	maxPendingDecryptions = 200
	maxPendingAge         = 24 * time.Hour
)

type pendingDecryption struct {
	AddedAt   int64           `json:"addedAt"`
	Attempts  int             `json:"attempts"`
	Event     json.RawMessage `json:"event"`
	EventID   string          `json:"eventId"`
	RoomID    string          `json:"roomId"`
	SenderKey string          `json:"senderKey,omitempty"`
	SessionID string          `json:"sessionId,omitempty"`
}

func (c *Core) loadPendingDecryptions(ctx context.Context) error {
	pending, err := c.stores.LoadPendingDecryption(ctx)
	if err != nil {
		return err
	}
	c.pendingDecryptions = c.trimPendingDecryptions(pending)
	return nil
}

func (c *Core) rememberPendingDecryption(ctx context.Context, evt *event.Event) {
	if evt == nil || evt.ID == "" || evt.Type != event.EventEncrypted {
		return
	}
	raw, err := json.Marshal(evt)
	if err != nil {
		return
	}
	_ = evt.Content.ParseRaw(evt.Type)
	content := evt.Content.AsEncrypted()
	eventID := evt.ID.String()
	next := pendingDecryption{
		AddedAt:   time.Now().UnixMilli(),
		Event:     raw,
		EventID:   eventID,
		RoomID:    evt.RoomID.String(),
		SenderKey: content.SenderKey.String(),
		SessionID: content.SessionID.String(),
	}
	for index, existing := range c.pendingDecryptions {
		if existing.EventID == eventID {
			next.AddedAt = existing.AddedAt
			next.Attempts = existing.Attempts
			c.pendingDecryptions[index] = next
			_ = c.savePendingDecryptions(ctx)
			return
		}
	}
	c.pendingDecryptions = append(c.pendingDecryptions, next)
	_ = c.savePendingDecryptions(ctx)
	if c.crypto != nil && content.SenderKey != "" && content.SessionID != "" {
		go c.crypto.RequestSession(context.Background(), evt.RoomID, content.SenderKey, content.SessionID, evt.Sender, content.DeviceID)
	}
}

func (c *Core) retryPendingDecryptions(ctx context.Context) {
	if len(c.pendingDecryptions) == 0 || c.crypto == nil {
		return
	}
	remaining := c.pendingDecryptions[:0]
	changed := false
	for _, pending := range c.trimPendingDecryptions(c.pendingDecryptions) {
		var evt event.Event
		if err := json.Unmarshal(pending.Event, &evt); err != nil {
			changed = true
			continue
		}
		decrypted, err := c.decryptIfNeeded(ctx, &evt)
		if err != nil {
			pending.Attempts++
			remaining = append(remaining, pending)
			changed = true
			continue
		}
		if decrypted.Type == event.EventMessage {
			if converted := c.convertMessageEvent(decrypted); converted != nil {
				c.emit(OutboundEvent{"type": "message", "event": converted})
			}
		}
		changed = true
	}
	c.pendingDecryptions = c.trimPendingDecryptions(remaining)
	if changed {
		_ = c.savePendingDecryptions(ctx)
	}
}

func (c *Core) removePendingDecryption(ctx context.Context, eventID id.EventID) {
	if eventID == "" || len(c.pendingDecryptions) == 0 {
		return
	}
	changed := false
	remaining := c.pendingDecryptions[:0]
	for _, pending := range c.pendingDecryptions {
		if pending.EventID == eventID.String() {
			changed = true
			continue
		}
		remaining = append(remaining, pending)
	}
	c.pendingDecryptions = remaining
	if changed {
		_ = c.savePendingDecryptions(ctx)
	}
}

func (c *Core) trimPendingDecryptions(pending []pendingDecryption) []pendingDecryption {
	cutoff := time.Now().Add(-maxPendingAge).UnixMilli()
	trimmed := pending[:0]
	for _, item := range pending {
		if item.EventID == "" || item.AddedAt < cutoff {
			continue
		}
		trimmed = append(trimmed, item)
	}
	sort.SliceStable(trimmed, func(i, j int) bool {
		return trimmed[i].AddedAt > trimmed[j].AddedAt
	})
	if len(trimmed) > maxPendingDecryptions {
		trimmed = trimmed[:maxPendingDecryptions]
	}
	return trimmed
}

func (c *Core) savePendingDecryptions(ctx context.Context) error {
	if c.stores == nil {
		return nil
	}
	return c.stores.SavePendingDecryption(ctx, c.pendingDecryptions)
}
