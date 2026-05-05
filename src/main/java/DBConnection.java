import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

public class DBConnection {
private static final String URL = "jdbc:postgresql://dpg-d7s8ocn7f7vs73dghaj0-a.frankfurt-postgres.render.com:5432/giocodb";
private static final String USER = "giocodb_user";
private static final String PASS = "aUP9VdHcR0yDcuWvL7WZ8RdZWY3bvwum";

    public static Connection getConnection() throws SQLException {
        try {
            Class.forName("org.postgresql.Driver");
        } catch (ClassNotFoundException e) {
            throw new SQLException("Driver PostgreSQL non trovato: " + e.getMessage());
        }
        return DriverManager.getConnection(URL, USER, PASS);
    }
}