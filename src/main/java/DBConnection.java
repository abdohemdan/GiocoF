import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

public class DBConnection {
private static final String URL = "jdbc:mysql://b6fqjihuzy40pxap35pl-mysql.services.clever-cloud.com:3306/b6fqjihuzy40pxap35pl?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true";
private static final String USER = "uqoskkdbxvsuuuv2";
private static final String PASS = "2xnhUg4VyNSLrkT6aOpk";
    
    public static Connection getConnection() throws SQLException {
        try {
            Class.forName("com.mysql.cj.jdbc.Driver");
        } catch (ClassNotFoundException e) {
            throw new SQLException("Driver MySQL non trovato: " + e.getMessage());
        }
        return DriverManager.getConnection(URL, USER, PASS);
    }
}