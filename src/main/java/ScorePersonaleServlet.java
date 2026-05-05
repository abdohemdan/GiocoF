import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.io.PrintWriter;
import java.sql.*;

/**
 * Restituisce il miglior score personale dell'utente loggato
 * per un circuito specifico.
 *
 * GET /GiocoF/ScorePersonale?idCircuito=5
 *
 * Risposta successo (record trovato):
 *   {"ok":true, "tempoMs":85432, "tempoFormattato":"01:25.432"}
 *
 * Risposta successo (nessun record):
 *   {"ok":true, "tempoMs":null}
 *
 * Risposta errore:
 *   {"ok":false, "errore":"..."}
 */
@WebServlet("/ScorePersonale")
public class ScorePersonaleServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json;charset=UTF-8");
        // Permette le chiamate AJAX dalla stessa origin
        response.setHeader("Cache-Control", "no-cache");
        PrintWriter out = response.getWriter();

        // 1. Controlla la sessione
        HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute("userId") == null) {
            out.print("{\"ok\":false,\"errore\":\"Non autenticato\"}");
            return;
        }

        int userId = (int) session.getAttribute("userId");

        // 2. Legge il parametro idCircuito
        String idCircuitoStr = request.getParameter("idCircuito");
        if (idCircuitoStr == null || idCircuitoStr.trim().isEmpty()) {
            out.print("{\"ok\":false,\"errore\":\"Parametro idCircuito mancante\"}");
            return;
        }

        try {
            int idCircuito = Integer.parseInt(idCircuitoStr.trim());
            boolean customMap = "true".equalsIgnoreCase(request.getParameter("customMap")) || "1".equals(request.getParameter("customMap"));

            // ✅ VALIDAZIONE: idCircuito deve essere > 0
            if (idCircuito <= 0) {
                System.out.println("⚠️ ScorePersonaleServlet: idCircuito non valido: " + idCircuito + " per utente " + userId);
                out.print("{\"ok\":false,\"errore\":\"idCircuito non valido\"}");
                return;
            }

            // 3. Cerca il record personale nel DB — usa tabella corretta in base al tipo di mappa
            try (Connection conn = DBConnection.getConnection()) {
                String scoreTable = customMap ? "score_custom" : "score";
                String sql = "SELECT tempo_ms FROM " + scoreTable + " " +
                             "WHERE id_utente = ? AND id_circuito = ?";

                try (PreparedStatement ps = conn.prepareStatement(sql)) {
                    ps.setInt(1, userId);
                    ps.setInt(2, idCircuito);
                    ResultSet rs = ps.executeQuery();

                    if (rs.next()) {
                        long tempoMs = rs.getLong("tempo_ms");
                        String formattato = formattaTempo(tempoMs);
                        out.print("{\"ok\":true," +
                                  "\"tempoMs\":" + tempoMs + "," +
                                  "\"tempoFormattato\":\"" + formattato + "\"}");
                    } else {
                        // Utente loggato ma non ha ancora un record su questo circuito
                        out.print("{\"ok\":true,\"tempoMs\":null}");
                    }
                }
            }

        } catch (NumberFormatException e) {
            out.print("{\"ok\":false,\"errore\":\"idCircuito non valido\"}");
        } catch (SQLException e) {
            System.err.println("❌ ScorePersonaleServlet SQL: " + e.getMessage());
            out.print("{\"ok\":false,\"errore\":\"Errore database\"}");
        }
    }

    /**
     * Formatta un tempo in millisecondi nel formato MM:SS.mmm
     * Es: 85432 ms → "01:25.432"
     */
    private String formattaTempo(long ms) {
        long min = ms / 60000;
        long sec = (ms % 60000) / 1000;
        long mil = ms % 1000;
        return String.format("%02d:%02d.%03d", min, sec, mil);
    }
}
