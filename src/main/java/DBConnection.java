import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

public class DBConnection {
    private static final String URL = "jdbc:mysql://sql7.freesqldatabase.com:3306/sql7825099?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true";
private static final String USER = "sql7825099";
private static final String PASS = "Hx9L9lBB7X";
    
    public static Connection getConnection() throws SQLException {
        try {
            Class.forName("com.mysql.cj.jdbc.Driver");
        } catch (ClassNotFoundException e) {
            throw new SQLException("Driver MySQL non trovato: " + e.getMessage());
        }
        return DriverManager.getConnection(URL, USER, PASS);
    }
}