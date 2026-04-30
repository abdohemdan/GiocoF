import java.io.IOException;
import java.io.PrintWriter;
import java.sql.*;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

/**
 * Restituisce le domande di sicurezza associate a un'email.
 * Usato dal flusso "Dimentica password" per mostrare le domande all'utente.
 *
 * GET /GiocoF/GetDomandeSicurezza?email=xxx
 *
 * Risposta se trovato:
 *   {"ok":true, "domanda1":"...", "domanda2":"..."}
 *
 * Risposta se non trovato o senza domande:
 *   {"ok":false, "errore":"..."}
 */
@WebServlet("/GetDomandeSicurezza")
public class GetDomandeSicurezzaServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json;charset=UTF-8");
        response.setHeader("Cache-Control", "no-cache");
        PrintWriter out = response.getWriter();

        String email = request.getParameter("email");
        if (email == null || email.trim().isEmpty()) {
            out.print("{\"ok\":false,\"errore\":\"Email non fornita\"}");
            return;
        }
        email = email.trim().toLowerCase();

        try (Connection conn = DBConnection.getConnection()) {
            String sql = "SELECT domanda1, domanda2, password_hash " +
                         "FROM utente WHERE email = ?";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setString(1, email);
                ResultSet rs = ps.executeQuery();

                if (!rs.next()) {
                    // Non riveliamo se l'email esiste o no per sicurezza
                    out.print("{\"ok\":false,\"errore\":\"Nessun account trovato con questa email\"}");
                    return;
                }

                String passwordHash = rs.getString("password_hash");
                // Gli account Google non hanno password: non possono usare questo flusso
                if (passwordHash == null) {
                    out.print("{\"ok\":false,\"errore\":\"Questo account usa il login con Google. Non puoi recuperare la password.\"}");
                    return;
                }

                String domanda1 = rs.getString("domanda1");
                String domanda2 = rs.getString("domanda2");

                if (domanda1 == null || domanda2 == null) {
                    out.print("{\"ok\":false,\"errore\":\"Nessuna domanda di sicurezza impostata per questo account. Contatta il supporto.\"}");
                    return;
                }

                // Escape semplice per JSON (evita injection)
                domanda1 = domanda1.replace("\"", "\\\"");
                domanda2 = domanda2.replace("\"", "\\\"");

                out.print("{\"ok\":true,\"domanda1\":\"" + domanda1 + "\",\"domanda2\":\"" + domanda2 + "\"}");
            }
        } catch (SQLException e) {
            System.out.println("❌ ERRORE GetDomandeSicurezza: " + e.getMessage());
            out.print("{\"ok\":false,\"errore\":\"Errore database\"}");
        }
    }
}
