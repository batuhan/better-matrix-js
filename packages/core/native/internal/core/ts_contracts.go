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

// ts:export MatrixMediaInfo
type tsMediaInfo struct {
	ContentType *string `json:"contentType,omitempty"`
	Duration    *int64  `json:"duration,omitempty"`
	Height      *int    `json:"height,omitempty"`
	Size        *int64  `json:"size,omitempty"`
	Width       *int    `json:"width,omitempty"`
}

// ts:export MatrixMediaAttachment
type tsMediaAttachment struct {
	ContentURI    *string        `json:"contentUri,omitempty"`
	EncryptedFile *encryptedFile `json:"encryptedFile,omitempty" ts:"MatrixEncryptedFile"`
	Filename      *string        `json:"filename,omitempty"`
	Info          *tsMediaInfo   `json:"info,omitempty"`
	Msgtype       string         `json:"msgtype" ts:"\"m.image\" | \"m.video\" | \"m.audio\" | \"m.file\""`
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
	Added            *bool  `json:"added,omitempty"`
	Key              string `json:"key"`
	RelatesToEventID string `json:"relatesToEventId"`
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

// ts:export MatrixFetchMessagesResult
type tsFetchMessagesResult struct {
	Messages   []tsMessageEvent `json:"messages"`
	NextCursor *string          `json:"nextCursor,omitempty"`
}

// ts:export MatrixFetchMessageResult
type tsFetchMessageResult struct {
	Message *tsMessageEvent `json:"message" ts:"MatrixMessageEvent | null"`
}

// ts:export MatrixUploadMediaResult
type tsUploadMediaResult struct {
	ContentURI string `json:"contentUri"`
	Raw        any    `json:"raw"`
}

// ts:export MatrixDownloadMediaResult
type tsDownloadMediaResult struct {
	BytesBase64 string `json:"bytesBase64"`
}

// ts:export MatrixUploadEncryptedMediaResult
type tsUploadEncryptedMediaResult struct {
	ContentURI string        `json:"contentUri"`
	File       encryptedFile `json:"file" ts:"MatrixEncryptedFile"`
	Raw        any           `json:"raw"`
}

// ts:export MatrixOpenDMResult
type tsOpenDMResult struct {
	Raw    any    `json:"raw"`
	RoomID string `json:"roomId"`
}

// ts:export MatrixJoinRoomResult
type tsJoinRoomResult struct {
	Raw    any    `json:"raw"`
	RoomID string `json:"roomId"`
}

// ts:export MatrixJoinedRoomsResult
type tsJoinedRoomsResult struct {
	Raw     any      `json:"raw"`
	RoomIDs []string `json:"roomIds"`
}

// ts:export MatrixUserInfo
type tsUserInfo struct {
	AvatarURL   *string `json:"avatarUrl,omitempty"`
	DisplayName *string `json:"displayName,omitempty"`
	Raw         any     `json:"raw"`
	UserID      string  `json:"userId"`
}

// ts:export MatrixListRoomThreadsResult
type tsListRoomThreadsResult struct {
	NextCursor *string               `json:"nextCursor,omitempty"`
	Threads    []tsRoomThreadSummary `json:"threads"`
}
