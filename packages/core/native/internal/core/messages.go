package core

import (
	"context"
	"encoding/json"
	"errors"
	"sort"
	"time"

	"maunium.net/go/mautrix"
	"maunium.net/go/mautrix/event"
	"maunium.net/go/mautrix/id"
)

type sendReq struct {
	RoomID            string       `json:"roomId"`
	Body              string       `json:"body"`
	FormattedBody     string       `json:"formattedBody,omitempty"`
	Mentions          *mentionsReq `json:"mentions,omitempty"`
	MsgType           string       `json:"msgtype,omitempty"`
	ThreadRootEventID string       `json:"threadRootEventId,omitempty"`
	ReplyToEventID    string       `json:"replyToEventId,omitempty"`
}

type mentionsReq struct {
	Room    bool     `json:"room,omitempty"`
	UserIDs []string `json:"userIds,omitempty"`
}

type rawMessageResp struct {
	EventID string `json:"eventId"`
	RoomID  string `json:"roomId"`
	Raw     any    `json:"raw"`
}

func (c *Core) handlePostMessage(ctx context.Context, payload []byte) ([]byte, error) {
	cli, err := c.requireClient()
	if err != nil {
		return nil, err
	}
	var req sendReq
	if err := json.Unmarshal(payload, &req); err != nil {
		return nil, err
	}
	content := messageContent(req.Body, req.FormattedBody, req.MsgType, req.Mentions)
	if req.ThreadRootEventID != "" {
		content.RelatesTo = (&event.RelatesTo{}).SetThread(id.EventID(req.ThreadRootEventID), "")
	} else if req.ReplyToEventID != "" {
		content.RelatesTo = (&event.RelatesTo{}).SetReplyTo(id.EventID(req.ReplyToEventID))
	}
	resp, err := cli.SendMessageEvent(ctx, id.RoomID(req.RoomID), event.EventMessage, content)
	if err != nil {
		return nil, err
	}
	return json.Marshal(rawMessageResp{EventID: resp.EventID.String(), RoomID: req.RoomID, Raw: resp})
}

type editReq struct {
	RoomID        string `json:"roomId"`
	MessageID     string `json:"messageId"`
	Body          string `json:"body"`
	FormattedBody string `json:"formattedBody,omitempty"`
	MsgType       string `json:"msgtype,omitempty"`
}

func (c *Core) handleEditMessage(ctx context.Context, payload []byte) ([]byte, error) {
	cli, err := c.requireClient()
	if err != nil {
		return nil, err
	}
	var req editReq
	if err := json.Unmarshal(payload, &req); err != nil {
		return nil, err
	}
	newContent := messageContent(req.Body, req.FormattedBody, req.MsgType, nil)
	content := &event.MessageEventContent{
		Body:       "",
		MsgType:    newContent.MsgType,
		NewContent: newContent,
		RelatesTo:  (&event.RelatesTo{}).SetReplace(id.EventID(req.MessageID)),
	}
	resp, err := cli.SendMessageEvent(ctx, id.RoomID(req.RoomID), event.EventMessage, content)
	if err != nil {
		return nil, err
	}
	return json.Marshal(rawMessageResp{EventID: resp.EventID.String(), RoomID: req.RoomID, Raw: resp})
}

type deleteReq struct {
	RoomID    string `json:"roomId"`
	MessageID string `json:"messageId"`
	Reason    string `json:"reason,omitempty"`
}

func (c *Core) handleDeleteMessage(ctx context.Context, payload []byte) ([]byte, error) {
	cli, err := c.requireClient()
	if err != nil {
		return nil, err
	}
	var req deleteReq
	if err := json.Unmarshal(payload, &req); err != nil {
		return nil, err
	}
	_, err = cli.RedactEvent(ctx, id.RoomID(req.RoomID), id.EventID(req.MessageID), mautrix.ReqRedact{Reason: req.Reason})
	if err != nil {
		return nil, err
	}
	return c.empty()
}

type typingReq struct {
	RoomID    string `json:"roomId"`
	Typing    bool   `json:"typing"`
	TimeoutMS int    `json:"timeoutMs,omitempty"`
}

func (c *Core) handleSetTyping(ctx context.Context, payload []byte) ([]byte, error) {
	cli, err := c.requireClient()
	if err != nil {
		return nil, err
	}
	var req typingReq
	if err := json.Unmarshal(payload, &req); err != nil {
		return nil, err
	}
	_, err = cli.UserTyping(ctx, id.RoomID(req.RoomID), req.Typing, time.Duration(req.TimeoutMS)*time.Millisecond)
	if err != nil {
		return nil, err
	}
	return c.empty()
}

type fetchMessageReq struct {
	RoomID    string `json:"roomId"`
	MessageID string `json:"messageId"`
}

func (c *Core) handleFetchMessage(ctx context.Context, payload []byte) ([]byte, error) {
	cli, err := c.requireClient()
	if err != nil {
		return nil, err
	}
	var req fetchMessageReq
	if err := json.Unmarshal(payload, &req); err != nil {
		return nil, err
	}
	evt, err := cli.GetEvent(ctx, id.RoomID(req.RoomID), id.EventID(req.MessageID))
	if err != nil {
		return nil, err
	}
	if evt.RoomID == "" {
		evt.RoomID = id.RoomID(req.RoomID)
	}
	converted := c.convertMaybeEncryptedMessageEvent(ctx, evt)
	if converted == nil {
		return json.Marshal(OutboundEvent{"message": nil})
	}
	return json.Marshal(OutboundEvent{"message": converted})
}

type fetchMessagesReq struct {
	RoomID            string `json:"roomId"`
	Cursor            string `json:"cursor,omitempty"`
	Direction         string `json:"direction,omitempty"`
	Limit             int    `json:"limit,omitempty"`
	ThreadRootEventID string `json:"threadRootEventId,omitempty"`
}

func (c *Core) handleFetchMessages(ctx context.Context, payload []byte) ([]byte, error) {
	cli, err := c.requireClient()
	if err != nil {
		return nil, err
	}
	var req fetchMessagesReq
	if err := json.Unmarshal(payload, &req); err != nil {
		return nil, err
	}
	if req.Limit <= 0 {
		req.Limit = 50
	}
	dir := mautrix.DirectionBackward
	if req.Direction == "forward" {
		dir = mautrix.DirectionForward
	}
	if req.ThreadRootEventID != "" {
		return c.handleFetchThreadMessages(ctx, cli, req, dir)
	}
	resp, err := cli.Messages(ctx, id.RoomID(req.RoomID), req.Cursor, "", dir, nil, req.Limit)
	if err != nil {
		return nil, err
	}
	messages := make([]OutboundEvent, 0, len(resp.Chunk))
	for _, evt := range resp.Chunk {
		if evt != nil && evt.RoomID == "" {
			evt.RoomID = id.RoomID(req.RoomID)
		}
		if converted := c.convertMaybeEncryptedMessageEvent(ctx, evt); converted != nil {
			if converted["threadRootEventId"] != "" {
				continue
			}
			messages = append(messages, converted)
		}
	}
	sort.SliceStable(messages, func(i, j int) bool {
		left, _ := messages[i]["originServerTs"].(int64)
		right, _ := messages[j]["originServerTs"].(int64)
		return left < right
	})
	return json.Marshal(OutboundEvent{"messages": messages, "nextCursor": resp.End})
}

func (c *Core) handleFetchThreadMessages(ctx context.Context, cli *mautrix.Client, req fetchMessagesReq, dir mautrix.Direction) ([]byte, error) {
	limit := req.Limit
	includeRoot := req.Cursor == ""
	if includeRoot && limit > 1 {
		limit--
	}
	resp, err := cli.GetRelations(ctx, id.RoomID(req.RoomID), id.EventID(req.ThreadRootEventID), &mautrix.ReqGetRelations{
		RelationType: event.RelThread,
		Dir:          dir,
		From:         req.Cursor,
		Limit:        limit,
	})
	if err != nil {
		return nil, err
	}
	messages := make([]OutboundEvent, 0, len(resp.Chunk)+1)
	if includeRoot {
		root, err := cli.GetEvent(ctx, id.RoomID(req.RoomID), id.EventID(req.ThreadRootEventID))
		if err == nil {
			if root.RoomID == "" {
				root.RoomID = id.RoomID(req.RoomID)
			}
			if converted := c.convertMaybeEncryptedMessageEvent(ctx, root); converted != nil {
				messages = append(messages, converted)
			}
		} else if !errors.Is(err, mautrix.MNotFound) {
			return nil, err
		}
	}
	for _, evt := range resp.Chunk {
		if evt != nil && evt.RoomID == "" {
			evt.RoomID = id.RoomID(req.RoomID)
		}
		if converted := c.convertMaybeEncryptedMessageEvent(ctx, evt); converted != nil {
			if converted["threadRootEventId"] == req.ThreadRootEventID {
				messages = append(messages, converted)
			}
		}
	}
	sort.SliceStable(messages, func(i, j int) bool {
		left, _ := messages[i]["originServerTs"].(int64)
		right, _ := messages[j]["originServerTs"].(int64)
		return left < right
	})
	nextCursor := resp.NextBatch
	if dir == mautrix.DirectionForward {
		nextCursor = resp.PrevBatch
	}
	return json.Marshal(OutboundEvent{"messages": messages, "nextCursor": nextCursor})
}

type markReadReq struct {
	EventID string `json:"eventId"`
	RoomID  string `json:"roomId"`
}

func (c *Core) handleMarkRead(ctx context.Context, payload []byte) ([]byte, error) {
	cli, err := c.requireClient()
	if err != nil {
		return nil, err
	}
	var req markReadReq
	if err := json.Unmarshal(payload, &req); err != nil {
		return nil, err
	}
	err = cli.MarkRead(ctx, id.RoomID(req.RoomID), id.EventID(req.EventID))
	return c.emptyIfNil(err)
}

func (c *Core) convertMessageEvent(evt *event.Event) OutboundEvent {
	if evt == nil {
		return nil
	}
	_ = evt.Content.ParseRaw(evt.Type)
	content := evt.Content.AsMessage()
	if content.RelatesTo.GetReplaceID() != "" {
		return nil
	}
	content.RemoveReplyFallback()
	threadRoot := ""
	if content.RelatesTo != nil {
		threadRoot = content.RelatesTo.GetThreadParent().String()
	}
	isEdited := false
	if evt.Unsigned.Relations != nil && len(evt.Unsigned.Relations.Replaces.List) > 0 {
		isEdited = true
	}
	return OutboundEvent{
		"attachments":       messageAttachments(content),
		"body":              content.Body,
		"content":           evt.Content.Raw,
		"eventId":           evt.ID.String(),
		"formattedBody":     content.FormattedBody,
		"isEncrypted":       evt.Mautrix.EventSource&event.SourceDecrypted != 0 || evt.Mautrix.WasEncrypted,
		"isEdited":          isEdited,
		"isMe":              evt.Sender == c.userID,
		"msgtype":           string(content.MsgType),
		"originServerTs":    evt.Timestamp,
		"raw":               evt,
		"roomId":            evt.RoomID.String(),
		"sender":            evt.Sender.String(),
		"threadRootEventId": threadRoot,
		"type":              evt.Type.Type,
	}
}

func messageContent(body, formattedBody, msgType string, mentions *mentionsReq) *event.MessageEventContent {
	if msgType == "" {
		msgType = string(event.MsgText)
	}
	content := &event.MessageEventContent{
		Body:    body,
		MsgType: event.MessageType(msgType),
	}
	if formattedBody != "" && formattedBody != body {
		content.Format = event.FormatHTML
		content.FormattedBody = formattedBody
	}
	if mentions != nil && (mentions.Room || len(mentions.UserIDs) > 0) {
		content.Mentions = &event.Mentions{Room: mentions.Room}
		for _, userID := range mentions.UserIDs {
			content.Mentions.Add(id.UserID(userID))
		}
	}
	return content
}
