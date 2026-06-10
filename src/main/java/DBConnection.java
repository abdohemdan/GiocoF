import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

public class DBConnection {
private static final String URL  = System.getenv("DB_URL");
private static final String USER = System.getenv("DB_USER");
private static final String PASS = System.getenv("DB_PASS");

    public static Connection getConnection() throws SQLException {
        try {
            Class.forName("org.postgresql.Driver");
        } catch (ClassNotFoundException e) {
            throw new SQLException("Driver PostgreSQL non trovato: " + e.getMessage());
        }
        return DriverManager.getConnection(URL, USER, PASS);
    }
}