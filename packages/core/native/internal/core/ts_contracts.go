package core

// ts:export MatrixRawEvent
type tsRawEvent struct {
	Content        map[string]any `json:"content"`
	EventID        string         `json:"eventId"`
	IsMe           *bool          `json:"isMe,omitempty"`
	OriginServerTS *int64         `json:"originServerTs,omitempty"`
	Raw            any            `json:"raw"`
	RoomID         string         `json:"roomId"`
	Sender         string         `json:"sender"`
	Type           string         `json:"type"`
}

// ts:export MatrixMentions
type tsMentions struct {
	Room    *bool    `json:"room,omitempty"`
	UserIDs []string `json:"userIds,omitempty"`
}

// ts:export MatrixMediaInfo
type tsMediaInfo struct {
	ContentType *string `json:"contentType,omitempty"`
	Duration    *int64  `json:"duration,omitempty"`
	Height      *int    `json:"height,omitempty"`
	Size        *int64  `json:"size,omitempty"`
	Width       *int    `json:"width,omitempty"`
}

// ts:export MatrixEncryptedFileKey
type tsEncryptedFileKey struct {
	Alg    string   `json:"alg" ts:"\"A256CTR\""`
	Ext    bool     `json:"ext" ts:"true"`
	K      string   `json:"k"`
	KeyOps []string `json:"key_ops" ts:"[\"encrypt\", \"decrypt\"]"`
	Kty    string   `json:"kty" ts:"\"oct\""`
}

// ts:export MatrixEncryptedFile
type tsEncryptedFile struct {
	Hashes map[string]string   `json:"hashes" ts:"{ sha256: string }"`
	IV     string              `json:"iv"`
	Key    tsEncryptedFileKey  `json:"key"`
	URL    string              `json:"url"`
	V      string              `json:"v" ts:"\"v2\""`
}

// ts:export MatrixMediaAttachment
type tsMediaAttachment struct {
	ContentURI    *string          `json:"contentUri,omitempty"`
	EncryptedFile *tsEncryptedFile `json:"encryptedFile,omitempty"`
	Filename      *string          `json:"filename,omitempty"`
	Info          *tsMediaInfo     `json:"info,omitempty"`
	Msgtype       string           `json:"msgtype" ts:"\"m.image\" | \"m.video\" | \"m.audio\" | \"m.file\""`
}

// ts:export MatrixMessageEvent
type tsMessageEvent struct {
	tsRawEvent
	Attachments       []tsMediaAttachment `json:"attachments,omitempty"`
	Body              string              `json:"body"`
	FormattedBody     *string             `json:"formattedBody,omitempty"`
	IsEncrypted       *bool               `json:"isEncrypted,omitempty"`
	IsEdited          *bool               `json:"isEdited,omitempty"`
	Msgtype           string              `json:"msgtype"`
	ThreadRootEventID *string             `json:"threadRootEventId,omitempty"`
}

func (evt *tsMessageEvent) setThreadRoot(threadRoot string) {
	if threadRoot != "" && evt.ThreadRootEventID == nil {
		evt.ThreadRootEventID = &threadRoot
	}
}

func optionalString(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}

func stringValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func boolValue(value *bool) bool {
	return value != nil && *value
}

func int64Value(value *int64) int64 {
	if value == nil {
		return 0
	}
	return *value
}

// ts:export MatrixReactionEvent
type tsReactionEvent struct {
	tsRawEvent
	Added            *bool   `json:"added,omitempty"`
	Key              string  `json:"key"`
	RelatesToEventID string  `json:"relatesToEventId"`
}

// ts:export MatrixInviteEvent
type tsInviteEvent struct {
	Inviter *string `json:"inviter,omitempty"`
	Raw     any     `json:"raw"`
	RoomID  string  `json:"roomId"`
}

// ts:export MatrixRoomThreadSummary
type tsRoomThreadSummary struct {
	LastReplyTS *int64         `json:"lastReplyTs,omitempty"`
	ReplyCount  *int           `json:"replyCount,omitempty"`
	Root        tsMessageEvent `json:"root"`
}
