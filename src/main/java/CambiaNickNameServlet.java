import java.io.IOException;
import java.io.PrintWriter;
import java.sql.*;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

@WebServlet("/CambiaNickname")
public class CambiaNickNameServlet extends HttpServlet {

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        PrintWriter out = response.getWriter();

        // ── Verifica sessione ────────────────────────────────────────────────
        HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute("userId") == null) {
            out.print("{\"ok\":false,\"errore\":\"Non sei autenticato\"}");
            return;
        }

        int userId = (int) session.getAttribute("userId");

        // ── Leggi e valida il nuovo nickname ────────────────────────────────
        String nuovoNome = request.getParameter("nakName");

        if (nuovoNome == null || nuovoNome.trim().isEmpty()) {
            out.print("{\"ok\":false,\"errore\":\"Nickname non valido\"}");
            return;
        }

        nuovoNome = nuovoNome.trim();

        if (nuovoNome.length() < 2) {
            out.print("{\"ok\":false,\"errore\":\"Il nickname deve avere almeno 2 caratteri\"}");
            return;
        }
        if (nuovoNome.length() > 50) {
            out.print("{\"ok\":false,\"errore\":\"Il nickname non può superare i 50 caratteri\"}");
            return;
        }

        try (Connection conn = DBConnection.getConnection()) {

            // ── Controlla che il nickname non sia già usato da un altro utente ──
            String checkSql = "SELECT id FROM utente WHERE nak_name = ? AND id != ?";
            try (PreparedStatement ps = conn.prepareStatement(checkSql)) {
                ps.setString(1, nuovoNome);
                ps.setInt(2, userId);
                ResultSet rs = ps.executeQuery();
                if (rs.next()) {
                    out.print("{\"ok\":false,\"errore\":\"Nickname già in uso da un altro giocatore\"}");
                    return;
                }
            }

            // ── Aggiorna solo nak_name, tutti gli altri dati restano intatti ──
            // (punteggi, email, password, google_id, avatar_url, ecc.)
            String updateSql = "UPDATE utente SET nak_name = ? WHERE id = ?";
            try (PreparedStatement ps = conn.prepareStatement(updateSql)) {
                ps.setString(1, nuovoNome);
                ps.setInt(2, userId);
                int righeAggiornate = ps.executeUpdate();

                if (righeAggiornate > 0) {
                    // Aggiorna anche la sessione corrente
                    session.setAttribute("nakName", nuovoNome);
                    out.print("{\"ok\":true,\"nakName\":\"" + nuovoNome + "\"}");
                    System.out.println("✅ Nickname aggiornato per userId=" + userId + " → " + nuovoNome);
                } else {
                    out.print("{\"ok\":false,\"errore\":\"Utente non trovato\"}");
                }
            }

        } catch (SQLException e) {
            System.out.println("❌ ERRORE SQL CambiaNickname: " + e.getMessage());
            out.print("{\"ok\":false,\"errore\":\"Errore database\"}");
        }
    }
}