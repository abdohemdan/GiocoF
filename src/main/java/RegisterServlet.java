import java.io.IOException;
import java.io.PrintWriter;
import java.sql.*;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import at.favre.lib.crypto.bcrypt.BCrypt;

@WebServlet("/Register")
public class RegisterServlet extends HttpServlet {

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        PrintWriter out = response.getWriter();

        String nakName   = request.getParameter("nak_name");
        String email     = request.getParameter("email");
        String password  = request.getParameter("password");
        String domanda1  = request.getParameter("domanda1");
        String risposta1 = request.getParameter("risposta1");
        String domanda2  = request.getParameter("domanda2");
        String risposta2 = request.getParameter("risposta2");

        // ── Validazione campi obbligatori base ──────────────────────────────
        if (nakName == null || nakName.trim().isEmpty() ||
            email    == null || email.trim().isEmpty()   ||
            password == null || password.trim().isEmpty()) {
            out.print("{\"ok\":false,\"errore\":\"Tutti i campi sono obbligatori\"}");
            return;
        }

        nakName  = nakName.trim();
        email    = email.trim().toLowerCase();
        password = password.trim();

        if (password.length() < 6) {
            out.print("{\"ok\":false,\"errore\":\"La password deve essere almeno 6 caratteri\"}");
            return;
        }

        // ── Validazione domande/risposte di sicurezza ───────────────────────
        boolean haDomande = (domanda1 != null && !domanda1.trim().isEmpty()) &&
                            (risposta1 != null && !risposta1.trim().isEmpty()) &&
                            (domanda2 != null && !domanda2.trim().isEmpty()) &&
                            (risposta2 != null && !risposta2.trim().isEmpty());

        String r1Hash = null, r2Hash = null;
        String d1 = null, d2 = null;

        if (haDomande) {
            d1 = domanda1.trim();
            d2 = domanda2.trim();
            String r1 = risposta1.trim().toLowerCase();
            String r2 = risposta2.trim().toLowerCase();

            // Le risposte devono essere una singola parola (senza spazi)
            if (r1.contains(" ") || r1.isEmpty()) {
                out.print("{\"ok\":false,\"errore\":\"La risposta alla domanda 1 deve essere una sola parola\"}");
                return;
            }
            if (r2.contains(" ") || r2.isEmpty()) {
                out.print("{\"ok\":false,\"errore\":\"La risposta alla domanda 2 deve essere una sola parola\"}");
                return;
            }

            // Hash delle risposte con BCrypt (stessa logica della password)
            r1Hash = BCrypt.withDefaults().hashToString(12, r1.toCharArray());
            r2Hash = BCrypt.withDefaults().hashToString(12, r2.toCharArray());
        }

        // Hash della password con BCrypt
        String passwordHash = BCrypt.withDefaults().hashToString(12, password.toCharArray());

        try (Connection conn = DBConnection.getConnection()) {

            // Controlla se email o nickname già esistono
            String checkSql = "SELECT id FROM utente WHERE email = ? OR nak_name = ?";
            try (PreparedStatement ps = conn.prepareStatement(checkSql)) {
                ps.setString(1, email);
                ps.setString(2, nakName);
                ResultSet rs = ps.executeQuery();
                if (rs.next()) {
                    out.print("{\"ok\":false,\"errore\":\"Email o nickname già in uso\"}");
                    return;
                }
            }

            // Inserisci nuovo utente (con o senza domande di sicurezza)
            String insertSql = "INSERT INTO utente " +
                    "(nak_name, email, password_hash, domanda1, risposta1, domanda2, risposta2) " +
                    "VALUES (?, ?, ?, ?, ?, ?, ?)";
            try (PreparedStatement ps = conn.prepareStatement(insertSql, Statement.RETURN_GENERATED_KEYS)) {
                ps.setString(1, nakName);
                ps.setString(2, email);
                ps.setString(3, passwordHash);
                ps.setString(4, d1);    // può essere null se non fornite
                ps.setString(5, r1Hash);
                ps.setString(6, d2);
                ps.setString(7, r2Hash);
                ps.executeUpdate();

                ResultSet keys = ps.getGeneratedKeys();
                if (keys.next()) {
                    int userId = keys.getInt(1);
                    HttpSession session = request.getSession(true);
                    session.setAttribute("userId",  userId);
                    session.setAttribute("nakName", nakName);
                    session.setAttribute("email",   email);
                    out.print("{\"ok\":true,\"userId\":" + userId + ",\"nakName\":\"" + nakName + "\"}");
                    System.out.println("✅ Registrazione: " + email + (haDomande ? " [con domande sicurezza]" : " [senza domande sicurezza]"));
                }
            }

        } catch (SQLException e) {
            System.out.println("❌ ERRORE SQL Register: " + e.getMessage());
            out.print("{\"ok\":false,\"errore\":\"Errore database\"}");
        }
    }
}