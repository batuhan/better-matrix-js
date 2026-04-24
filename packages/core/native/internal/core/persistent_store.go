package core

import (
	"context"
	"fmt"

	"maunium.net/go/mautrix"
	"maunium.net/go/mautrix/crypto"
)

const (
	cryptoStoreFile = "crypto.json"
	stateStoreFile  = "state.json"
	nextBatchFile   = "next_batch"
)

type byteStore interface {
	Delete(ctx context.Context, key string) error
	Get(ctx context.Context, key string) ([]byte, error)
	List(ctx context.Context, prefix string) ([]string, error)
	Set(ctx context.Context, key string, value []byte) error
}

type storeBundle struct {
	CryptoStore crypto.Store
	StateStore  mautrix.StateStore
	kv          byteStore
	prefix      string
}

func newMemoryStoreBundle() *storeBundle {
	return &storeBundle{
		CryptoStore: crypto.NewMemoryStore(nil),
		StateStore:  mautrix.NewMemoryStateStore(),
	}
}

func newPersistentStoreBundle(ctx context.Context, kv byteStore, prefix string, pickleKey []byte) (*storeBundle, error) {
	cryptoStore, err := newPersistentCryptoStore(ctx, kv, prefix+cryptoStoreFile, pickleKey)
	if err != nil {
		return nil, fmt.Errorf("failed to load Matrix crypto store: %w", err)
	}
	stateStore, err := newPersistentStateStore(ctx, kv, prefix+stateStoreFile)
	if err != nil {
		return nil, fmt.Errorf("failed to load Matrix state store: %w", err)
	}
	return &storeBundle{
		CryptoStore: cryptoStore,
		StateStore:  stateStore,
		kv:          kv,
		prefix:      prefix,
	}, nil
}

func (bundle *storeBundle) LoadNextBatch(ctx context.Context) (string, error) {
	if bundle == nil || bundle.kv == nil {
		return "", nil
	}
	raw, err := bundle.kv.Get(ctx, bundle.prefix+nextBatchFile)
	if err != nil || raw == nil {
		return "", err
	}
	return string(raw), nil
}

func (bundle *storeBundle) SaveNextBatch(ctx context.Context, nextBatch string) error {
	if bundle == nil || bundle.kv == nil {
		return nil
	}
	if nextBatch == "" {
		return bundle.kv.Delete(ctx, bundle.prefix+nextBatchFile)
	}
	return bundle.kv.Set(ctx, bundle.prefix+nextBatchFile, []byte(nextBatch))
}
