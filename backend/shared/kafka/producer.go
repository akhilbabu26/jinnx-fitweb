package kafka

import(
	"fmt"
	"context"
	"encoding/json"
	"time"

	"github.com/IBM/sarama" //Go client library for Apache Kafka.
)

type Producer struct{
	p sarama.SyncProducer //It sends a message to Kafka and waits for Kafka's acknowledgment before continuing.
}

func NewProducer(brokers []string)(*Producer, error){
	cfg := sarama.NewConfig()
	cfg.Producer.Return.Successes = true
	cfg.Producer.RequiredAcks = sarama.WaitForLocal
	cfg.Producer.Retry.Max = 3
	cfg.Version = sarama.V2_6_0_0

	p, err := sarama.NewSyncProducer(brokers, cfg)
	if err != nil {
		return nil, err
	}
	return &Producer{p: p}, nil
}

func (p *Producer) Publish(ctx context.Context, e Event) error {
	e.Timestamp = time.Now()
	b, err := json.Marshal(e)
	if err != nil {
		return err
	}
	msg := &sarama.ProducerMessage{
		Topic: TopicEvents,
		Key:   sarama.StringEncoder(fmt.Sprintf("%d", e.ActorID)),
		Value: sarama.ByteEncoder(b),
	}
	_, _, err = p.p.SendMessage(msg)
	return err
}
func (p *Producer) Close() error {
	return p.p.Close()
}