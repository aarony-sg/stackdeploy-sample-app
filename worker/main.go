// Sample worker: processes queued jobs from Postgres and serves /healthz.
// With --cleanup (the cron job), it deletes finished jobs older than an hour and exits.
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync/atomic"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	cleanup := flag.Bool("cleanup", false, "delete finished jobs older than an hour, then exit")
	flag.Parse()

	ctx := context.Background()
	db, err := pgxpool.New(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	if *cleanup {
		tag, err := db.Exec(ctx, `DELETE FROM jobs WHERE status = 'done' AND finished_at < NOW() - INTERVAL '1 hour'`)
		if err != nil {
			log.Fatal(err)
		}
		log.Printf("cleanup: deleted %d finished jobs", tag.RowsAffected())
		return
	}

	var processed atomic.Int64
	go func() {
		for {
			// Claim one queued job at a time; SKIP LOCKED lets several replicas share the queue.
			tag, err := db.Exec(ctx, `
				UPDATE jobs SET status = 'done', finished_at = NOW()
				WHERE id = (SELECT id FROM jobs WHERE status = 'queued' ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED)`)
			switch {
			case err != nil:
				log.Printf("process: %v", err)
				time.Sleep(5 * time.Second)
			case tag.RowsAffected() == 0:
				time.Sleep(2 * time.Second)
			default:
				log.Printf("processed job #%d", processed.Add(1))
			}
		}
	}()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "processed %d jobs since start\n", processed.Load())
	})
	log.Printf("worker listening on %s", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
