module github.com/akhilbabu26/jinnx/services/workout

go 1.25.0

require (
	github.com/akhilbabu26/jinnx/proto v0.0.0
	github.com/akhilbabu26/jinnx/shared v0.0.0
	github.com/jmoiron/sqlx v1.4.0
	google.golang.org/grpc v1.80.0
)

require (
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/pgx/v5 v5.6.0 // indirect
	github.com/jackc/puddle/v2 v2.2.2 // indirect
	github.com/jinzhu/inflection v1.0.0 // indirect
	github.com/jinzhu/now v1.1.5 // indirect
	github.com/joho/godotenv v1.5.1 // indirect
	github.com/lib/pq v1.12.3 // indirect
	golang.org/x/crypto v0.51.0 // indirect
	golang.org/x/net v0.53.0 // indirect
	golang.org/x/sync v0.20.0 // indirect
	golang.org/x/sys v0.44.0 // indirect
	golang.org/x/text v0.37.0 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20260427160629-7cedc36a6bc4 // indirect
	google.golang.org/protobuf v1.36.11 // indirect
	gorm.io/driver/postgres v1.6.0 // indirect
	gorm.io/gorm v1.31.1 // indirect
)

replace (
	github.com/akhilbabu26/jinnx/proto => ../../proto
	github.com/akhilbabu26/jinnx/shared => ../../shared
)
