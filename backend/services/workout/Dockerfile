FROM golang:1.26-alpine AS builder
WORKDIR /app
COPY shared/ ./shared/
COPY proto/ ./proto/
COPY services/workout/ ./services/workout/
WORKDIR /app/services/workout
RUN go mod download && go build -o /bin/workout-service ./cmd/

FROM alpine:3.20
RUN apk --no-cache add ca-certificates
COPY --from=builder /bin/workout-service /bin/workout-service
ENTRYPOINT ["/bin/workout-service"]
