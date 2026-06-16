package migrations

import "embed"

// SQL holds all *.sql migration files embedded at compile time.
//
//go:embed *.sql
var SQL embed.FS
