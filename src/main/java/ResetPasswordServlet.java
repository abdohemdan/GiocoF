import java.io.IOException;
import java.io.PrintWriter;
import java.sql.*;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import at.favre.lib.crypto.bcrypt.BCrypt;

/**
 * Verifica le risposte alle domande di sicurezza e, se corrette,
 * aggiorna la password dell'utente.
 *
 * POST /ResetPassword
 *   Parametri:
 *     email        — email dell'account
 *     risposta1    — risposta alla prima domanda (una parola)
 *     risposta2    — risposta alla seconda domanda (una parola)
 *     nuovaPassword — nuova password (min 6 caratteri)
 *
 * Risposta successo:
 *   {"ok":true}
 *
 * Risposta errore:
 *   {"ok":false, "errore":"..."}
 */
@WebServlet("/ResetPassword")
public class ResetPasswordServlet extends HttpServlet {

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json;charset=UTF-8");
        PrintWriter out = response.getWriter();

        String email         = request.getParameter("email");
        String risposta1     = request.getParameter("risposta1");
        String risposta2     = request.getParameter("risposta2");
        String nuovaPassword = request.getParameter("nuovaPassword");

        // ── Validazione input ────────────────────────────────────────────────
        if (email == null || email.trim().isEmpty()) {
            out.print("{\"ok\":false,\"errore\":\"Email non fornita\"}");
            return;
        }
        if (risposta1 == null || risposta1.trim().isEmpty() ||
            risposta2 == null || risposta2.trim().isEmpty()) {
            out.print("{\"ok\":false,\"errore\":\"Risposte non fornite\"}");
            return;
        }
        if (nuovaPassword == null || nuovaPassword.trim().length() < 6) {
            out.print("{\"ok\":false,\"errore\":\"La nuova password deve essere almeno 6 caratteri\"}");
            return;
        }

        email         = email.trim().toLowerCase();
        String r1     = risposta1.trim().toLowerCase();
        String r2     = risposta2.trim().toLowerCase();
        nuovaPassword = nuovaPassword.trim();

        // Le risposte devono essere una parola sola
        if (r1.contains(" ")) {
            out.print("{\"ok\":false,\"errore\":\"La risposta 1 deve essere una sola parola\"}");
            return;
        }
        if (r2.contains(" ")) {
            out.print("{\"ok\":false,\"errore\":\"La risposta 2 deve essere una sola parola\"}");
            return;
        }

        try (Connection conn = DBConnection.getConnection()) {

            // Recupera hash delle risposte e hash password attuale
            String selectSql = "SELECT id, password_hash, risposta1, risposta2 " +
                                "FROM utente WHERE email = ?";
            try (PreparedStatement ps = conn.prepareStatement(selectSql)) {
                ps.setString(1, email);
                ResultSet rs = ps.executeQuery();

                if (!rs.next()) {
                    out.print("{\"ok\":false,\"errore\":\"Account non trovato\"}");
                    return;
                }

                int    userId       = rs.getInt("id");
                String passwordHash = rs.getString("password_hash");
                String hash1        = rs.getString("risposta1");
                String hash2        = rs.getString("risposta2");

                // Account Google non ha password
                if (passwordHash == null) {
                    out.print("{\"ok\":false,\"errore\":\"Questo account usa Google. Non puoi resettare la password.\"}");
                    return;
                }

                // Account senza domande di sicurezza
                if (hash1 == null || hash2 == null) {
                    out.print("{\"ok\":false,\"errore\":\"Nessuna domanda di sicurezza impostata per questo account\"}");
                    return;
                }

                // ── Verifica risposta 1 ──────────────────────────────────────
                BCrypt.Result check1 = BCrypt.verifyer().verify(r1.toCharArray(), hash1);
                if (!check1.verified) {
                    System.out.println("⚠️ Reset password fallito (risposta1 errata) per: " + email);
                    out.print("{\"ok\":false,\"errore\":\"Risposte errate. Riprova.\"}");
                    return;
                }

                // ── Verifica risposta 2 ──────────────────────────────────────
                BCrypt.Result check2 = BCrypt.verifyer().verify(r2.toCharArray(), hash2);
                if (!check2.verified) {
                    System.out.println("⚠️ Reset password fallito (risposta2 errata) per: " + email);
                    out.print("{\"ok\":false,\"errore\":\"Risposte errate. Riprova.\"}");
                    return;
                }

                // ── Risposte corrette: aggiorna la password ──────────────────
                String nuovoHash = BCrypt.withDefaults().hashToString(12, nuovaPassword.toCharArray());
                String updateSql = "UPDATE utente SET password_hash = ? WHERE id = ?";
                try (PreparedStatement psUp = conn.prepareStatement(updateSql)) {
                    psUp.setString(1, nuovoHash);
                    psUp.setInt(2, userId);
                    int righe = psUp.executeUpdate();
                    if (righe > 0) {
                        System.out.println("✅ Password resettata per userId=" + userId + " (" + email + ")");
                        out.print("{\"ok\":true}");
                    } else {
                        out.print("{\"ok\":false,\"errore\":\"Errore aggiornamento password\"}");
                    }
                }
            }

        } catch (SQLException e) {
            System.out.println("❌ ERRORE SQL ResetPassword: " + e.getMessage());
            out.print("{\"ok\":false,\"errore\":\"Errore database\"}");
        }
    }
}
