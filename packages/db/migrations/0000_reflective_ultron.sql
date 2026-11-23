CREATE TABLE "users" (
	"id" serial PRIMARY KEY,
	"email" varchar(255) NOT NULL UNIQUE,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
