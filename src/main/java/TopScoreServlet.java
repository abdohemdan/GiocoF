import java.io.IOException;
import java.io.PrintWriter;
import java.sql.*;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

@WebServlet("/TopScore")
public class TopScoreServlet extends HttpServlet {
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json");
        PrintWriter out = response.getWriter();
        
        try {
            int idCircuito = Integer.parseInt(request.getParameter("idCircuito"));
            boolean customMap = "true".equalsIgnoreCase(request.getParameter("customMap")) || "1".equals(request.getParameter("customMap"));
            
            // ✅ VALIDAZIONE: idCircuito deve essere > 0
            if (idCircuito <= 0) {
                System.out.println("⚠️ TopScore: idCircuito non valido: " + idCircuito);
                out.print("[]");
                return;
            }

            System.out.println("📊 TopScore request - Circuito: " + idCircuito + ", customMap: " + customMap);
            
            try (Connection conn = DBConnection.getConnection()) {
                String scoreTable = customMap ? "score_custom" : "score";
                
                // Nel racing il tempo MAGGIORE è il migliore (sopravvivenza) → ORDER BY DESC
                String sql = "SELECT u.nak_name, s.tempo_ms " +
                             "FROM " + scoreTable + " s " +
                             "JOIN utente u ON s.id_utente = u.id " +
                             "WHERE s.id_circuito = ? " +
                             "ORDER BY s.tempo_ms DESC LIMIT 10";

                System.out.println("🔍 Query: " + sql);
                System.out.println("📌 Parametro idCircuito: " + idCircuito);
                
                try (PreparedStatement ps = conn.prepareStatement(sql)) {
                    ps.setInt(1, idCircuito);
                    ResultSet rs = ps.executeQuery();
                    
                    StringBuilder json = new StringBuilder("[");
                    int pos = 1;
                    int recordCount = 0;
                    
                    while (rs.next()) {
                        recordCount++;
                        if (pos > 1) json.append(",");
                        
                        String nakName = rs.getString("nak_name");
                        long ms = rs.getLong("tempo_ms");
                        
                        json.append("{")
                            .append("\"posizione\":").append(pos).append(",")
                            .append("\"nakName\":\"").append(nakName).append("\",")
                            .append("\"tempoMs\":").append(ms).append(",")
                            .append("\"tempoFormattato\":\"").append(formatTime(ms)).append("\"")
                            .append("}");
                        pos++;
                    }
                    json.append("]");
                    
                    System.out.println("✅ Record trovati: " + recordCount);
                    System.out.println("📤 JSON ritornato: " + json.toString());
                    out.print(json.toString());
                }
            }
        } catch (Exception e) {
            System.out.println("❌ ERRORE TopScore: " + e.getMessage());
            e.printStackTrace();
            out.print("[]");
        }
    }
    
    private String formatTime(long ms) {
        long m  = ms / 60000;
        long s  = (ms % 60000) / 1000;
        long ml = ms % 1000;
        return String.format("%02d:%02d.%03d", m, s, ml);
    }
}