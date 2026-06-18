package hub

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/gofiber/contrib/websocket"

	"github.com/akhilbabu26/jinnx/shared/kafka"
)

// Hub manages all active WebSocket connections and fans out Kafka events to them.
type Hub struct {
	mu     sync.RWMutex
	users  map[uint][]*websocket.Conn // normal user connections
	admins []*websocket.Conn // admin connections (receive all events)
}

func New() *Hub {
	return &Hub{users: make(map[uint][]*websocket.Conn)}
}

// Register adds a new WebSocket connection to the hub.
func (h *Hub) Register(userID uint, isAdmin bool, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if isAdmin {
		h.admins = append(h.admins, conn)
	} else {
		h.users[userID] = append(h.users[userID], conn)
	}
	log.Printf("[hub] registered userID=%d isAdmin=%v", userID, isAdmin)
}

// Unregister removes a WebSocket connection from the hub on disconnect.
func (h *Hub) Unregister(userID uint, isAdmin bool, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if isAdmin {
		h.admins = removeConn(h.admins, conn)
	} else {
		conns := removeConn(h.users[userID], conn)
		if len(conns) == 0 {
			delete(h.users, userID)
		} else {
			h.users[userID] = conns
		}
	}
	log.Printf("[hub] unregistered userID=%d isAdmin=%v", userID, isAdmin)
}

// SendToUser pushes a JSON payload to a specific user's connections.
func (h *Hub) SendToUser(userID uint, payload []byte) {
	h.mu.RLock()
	conns := h.users[userID]
	h.mu.RUnlock()
	for _, c := range conns {
		if err := c.WriteMessage(websocket.TextMessage, payload); err != nil {
			log.Printf("[hub] write error for userID=%d: %v", userID, err)
		}
	}
}

// BroadcastToAdmins pushes a JSON payload to all connected admin connections.
func (h *Hub) BroadcastToAdmins(payload []byte) {
	h.mu.RLock()
	conns := h.admins
	h.mu.RUnlock()
	for _, c := range conns {
		if err := c.WriteMessage(websocket.TextMessage, payload); err != nil {
			log.Printf("[hub] admin write error: %v", err)
		}
	}
}

// HandleKafkaEvent is called by the Kafka consumer goroutine for each event.
// It routes the event to the correct WebSocket clients.
func (h *Hub) HandleKafkaEvent(e kafka.Event) {
	payload, err := json.Marshal(e)
	if err != nil {
		log.Printf("[hub] marshal error: %v", err)
		return
	}

	switch e.Type {
	case kafka.EventDayCompleted,
		kafka.EventTrialExpiring,
		kafka.EventSignupPending,
		kafka.EventSubscriptionCharged,
		kafka.EventSubscriptionCancelled:
		// Admin-level events — broadcast to all admins
		h.BroadcastToAdmins(payload)

	case kafka.EventPlanUpdated:
		// Notify the specific user whose plan was updated
		h.SendToUser(e.TargetID, payload)
		// Also notify admins so they know the plan was delivered
		h.BroadcastToAdmins(payload)
	}
}

// removeConn removes a specific connection from a slice.
func removeConn(conns []*websocket.Conn, target *websocket.Conn) []*websocket.Conn {
	result := conns[:0]
	for _, c := range conns {
		if c != target {
			result = append(result, c)
		}
	}
	return result
}
