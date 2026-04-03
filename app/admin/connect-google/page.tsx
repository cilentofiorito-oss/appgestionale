export default function ConnectGooglePage() {
  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "24px 16px" }}>
      <h1>Collega Google Calendar</h1>
      <p>Questa pagina serve solo a te per collegare Google e ottenere il refresh token.</p>

      <div style={{ marginTop: 16 }}>
        <a
          href="/api/auth/google"
          style={{
            display: "inline-block",
            padding: "12px 16px",
            borderRadius: 12,
            textDecoration: "none",
            background: "#d4af37",
            color: "#111",
            fontWeight: 800,
          }}
        >
          Collega Google
        </a>
      </div>
    </main>
  );
}
