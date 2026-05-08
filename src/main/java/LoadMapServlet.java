import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.io.PrintWriter;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

import org.json.JSONArray;
import org.json.JSONObject;

@WebServlet("/CaricaMappePersonalizzate")
public class LoadMapServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json");
        PrintWriter out = response.getWriter();

        // ✅ CORREZIONE: legge userId dalla SESSIONE, non dal parametro URL.
        // Prima era: Integer.parseInt(request.getParameter("userId"))
        // Questo permetteva a chiunque di vedere le mappe altrui cambiando
        // il parametro nella URL. Ora solo l'utente loggato vede le sue mappe.
        HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute("userId") == null) {
            out.print("[]");
            return;
        }

        int userId = (int) session.getAttribute("userId");

        try {
            System.out.println("📥 Caricamento mappe per utente (da sessione): " + userId);

            JSONArray mappeArray = new JSONArray();

            try (Connection conn = DBConnection.getConnection()) {
                String sql = "SELECT id, nome, \"mapData\", data_creazione " +
                             "FROM mappe_personalizzate " +
                             "WHERE id_utente = ? " +
                             "ORDER BY data_creazione DESC";

                try (PreparedStatement ps = conn.prepareStatement(sql)) {
                    ps.setInt(1, userId);
                    try (ResultSet rs = ps.executeQuery()) {
                        while (rs.next()) {
                            int    mapId        = rs.getInt("id");
                            String nome         = rs.getString("nome");
                            String mapDataJson  = rs.getString("mapData");
                            String dataCreaz    = rs.getString("data_creazione");

                            JSONObject mapData  = new JSONObject(mapDataJson);

                            JSONObject mappaObj = new JSONObject();
                            mappaObj.put("id",             mapId);
                            mappaObj.put("nome",           nome);
                            mappaObj.put("data_creazione", dataCreaz);
                            mappaObj.put("config",         mapData);

                            mappeArray.put(mappaObj);
                        }
                    }
                }
            }

            System.out.println("✅ Caricate " + mappeArray.length() + " mappe");
            out.print(mappeArray.toString());

        } catch (Exception e) {
            System.out.println("❌ ERRORE LoadMap: " + e.getMessage());
            e.printStackTrace();
            out.print("[]");
        }
    }
}