import java.sql.*;

public class Database {

    // CONFIGURAZIONE DATABASE
    private static final String URL = "jdbc:mysql://localhost:3306/gioco"; 
    private static final String USER = "root";
    private static final String PASSWORD = "password";

    // Connessione al DB
    public static Connection getConnection() throws SQLException {
        return DriverManager.getConnection(URL, USER, PASSWORD);
    }

    // Recupera utente tramite Google ID
    public static Utente getUtenteByGoogleId(String googleId) {
        String sql = "SELECT * FROM utenti WHERE google_id = ?";

        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {

            ps.setString(1, googleId);
            ResultSet rs = ps.executeQuery();

            if (rs.next()) {
                Utente u = new Utente();
                u.setId(rs.getInt("id"));
                u.setGoogleId(rs.getString("google_id"));
                u.setEmail(rs.getString("email"));
                u.setNome(rs.getString("nome"));
                return u;
            }

        } catch (Exception e) {
            e.printStackTrace();
        }

        return null;
    }

    // Registra nuovo utente Google
    public static void registraUtenteGoogle(String googleId, String email, String nome) {
        String sql = "INSERT INTO utenti (google_id, email, nome) VALUES (?, ?, ?)";

        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {

            ps.setString(1, googleId);
            ps.setString(2, email);
            ps.setString(3, nome);
            ps.executeUpdate();

        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
