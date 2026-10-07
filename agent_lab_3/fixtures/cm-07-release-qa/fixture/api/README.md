# Subscribe endpoint (edge function, unchanged in r2)

`POST /api/subscribe` with `Content-Type: application/json`.

Request body: `{ "email": "<address>", "consent": true }`. Both fields are required; any other shape is rejected with `400 {"error":"email required"}`.

Responses: `201 {"ok":true}` on success; `400` on a malformed body; `409` when the address is already subscribed.
Clients must treat anything other than a 2xx as a failure and tell the user.
