import java.io.IOException;
import java.io.PrintWriter;
import java.sql.*;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import at.favre.lib.crypto.bcrypt.BCrypt;

@WebServlet("/Login")
public class LoginServlet extends HttpServlet {

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        PrintWriter out = response.getWriter();

        String email    = request.getParameter("email");
        String password = request.getParameter("password");

        if (email == null || email.trim().isEmpty() ||
            password == null || password.trim().isEmpty()) {
            out.print("{\"ok\":false,\"errore\":\"Email e password obbligatorie\"}");
            return;
        }

        email    = email.trim().toLowerCase();
        password = password.trim();

        try (Connection conn = DBConnection.getConnection()) {
            String sql = "SELECT id, nak_name, password_hash FROM utente WHERE email = ?";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setString(1, email);
                ResultSet rs = ps.executeQuery();

                if (!rs.next()) {
                    out.print("{\"ok\":false,\"errore\":\"Email o password errati\"}");
                    return;
                }

                int    userId       = rs.getInt("id");
                String nakName      = rs.getString("nak_name");
                String passwordHash = rs.getString("password_hash");

                // Utente registrato con Google (nessuna password)
                if (passwordHash == null) {
                    out.print("{\"ok\":false,\"errore\":\"Usa il login con Google per questo account\"}");
                    return;
                }

                // Verifica password
                BCrypt.Result result = BCrypt.verifyer().verify(password.toCharArray(), passwordHash);
                if (!result.verified) {
                    out.print("{\"ok\":false,\"errore\":\"Email o password errati\"}");
                    return;
                }

                // Sessione
                HttpSession session = request.getSession(true);
                session.setAttribute("userId",  userId);
                session.setAttribute("nakName", nakName);
                session.setAttribute("email",   email);

                out.print("{\"ok\":true,\"userId\":" + userId + ",\"nakName\":\"" + nakName + "\"}");
                System.out.println("✅ Login riuscito: " + email);
            }

        } catch (SQLException e) {
            System.out.println("❌ ERRORE SQL Login: " + e.getMessage());
            out.print("{\"ok\":false,\"errore\":\"Errore database\"}");
        }
    }
}