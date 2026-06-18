package kafka

import (
	"context"
	"encoding/json"
	"log"

	"github.com/IBM/sarama"
)

type Handler func(e Event) // Handler = any function that accepts an Event and returns nothing

type Consumer struct {
	group   sarama.ConsumerGroup
	handler Handler
}

func NewConsumer(brokers []string, groupID string, handler Handler) (*Consumer, error) {
	cfg := sarama.NewConfig()
	cfg.Version = sarama.V2_6_0_0
	cfg.Consumer.Offsets.Initial = sarama.OffsetNewest
	cfg.Consumer.Group.Rebalance.GroupStrategies = []sarama.BalanceStrategy{
		sarama.NewBalanceStrategyRoundRobin(),
	}

	group, err := sarama.NewConsumerGroup(brokers, groupID, cfg)
	if err != nil {
		return nil, err
	}
	return &Consumer{group: group, handler: handler}, nil
}

// Start blocks — call in a goroutine.
func (c *Consumer) Start(ctx context.Context) {
	h := &consumerGroupHandler{handler: c.handler}
	for {
		if err := c.group.Consume(ctx, []string{TopicEvents}, h); err != nil {
			log.Printf("[kafka] consumer error: %v", err)
		}
		if ctx.Err() != nil {
			return
		}
	}
}

func (c *Consumer) Close() error {
	return c.group.Close()
}

type consumerGroupHandler struct {
	handler Handler
}

func (h *consumerGroupHandler) Setup(_ sarama.ConsumerGroupSession) error   { return nil }//Called once before consuming starts.
func (h *consumerGroupHandler) Cleanup(_ sarama.ConsumerGroupSession) error { return nil }// Called when the consumer stops or rebalances.

func (h *consumerGroupHandler) ConsumeClaim(
	sess sarama.ConsumerGroupSession,
	claim sarama.ConsumerGroupClaim,
) error {
	for msg := range claim.Messages() {
		var e Event
		if err := json.Unmarshal(msg.Value, &e); err != nil {
			log.Printf("[kafka] unmarshal error: %v", err)
		} else {
			h.handler(e)
		}
		sess.MarkMessage(msg, "")
	}
	return nil
}



// Consumes events from Kafka and forwards them to the appropriate business logic handler.