import java.sql.*;

public class ScoreDAO {

    /**
     * Salva o aggiorna il tempo.
     * Restituisce: 0 = inserito, 1 = aggiornato (nuovo record migliore), 2 = nessuna modifica (tempo non migliore)
     * 
     * Usa tabella 'score' per mappe fisse (idCircuito 1-3)
     * Usa tabella 'score_custom' per mappe personalizzate (idCircuito > 3)
     */
    public static int salvaScore(int idUtente, int idCircuito, long tempoMs, boolean customMap) throws SQLException {
        // ✅ VALIDAZIONE: id_circuito deve essere valido (> 0)
        if (idCircuito <= 0) {
            System.out.println("❌ ScoreDAO: idCircuito non valido: " + idCircuito);
            throw new IllegalArgumentException("idCircuito non valido: " + idCircuito);
        }

        try (Connection conn = DBConnection.getConnection()) {
            // Se è una mappa personalizzata, verifica solo che la mappa esista nel DB.
            // NON filtrare per id_utente: qualsiasi utente loggato può giocare qualsiasi mappa custom.
            if (customMap) {
                String checkMapSql = "SELECT COUNT(*) as cnt FROM mappe_personalizzate WHERE id = ?";
                try (PreparedStatement psCheck = conn.prepareStatement(checkMapSql)) {
                    psCheck.setInt(1, idCircuito);
                    try (ResultSet rsCheck = psCheck.executeQuery()) {
                        if (rsCheck.next() && rsCheck.getInt("cnt") == 0) {
                            System.out.println("❌ ScoreDAO: Mappa personalizzata " + idCircuito + " non trovata");
                            throw new IllegalArgumentException("Mappa personalizzata non trovata: " + idCircuito);
                        }
                    }
                }
            }

            String scoreTable = customMap ? "score_custom" : "score";
            String selectSql = "SELECT tempo_ms FROM " + scoreTable + " WHERE id_utente = ? AND id_circuito = ?";
            try (PreparedStatement ps = conn.prepareStatement(selectSql)) {
                ps.setInt(1, idUtente);
                ps.setInt(2, idCircuito);
                ResultSet rs = ps.executeQuery();

                if (rs.next()) {
                    long recordAttuale = rs.getLong("tempo_ms");
                    if (tempoMs > recordAttuale) {
                        String updateSql = "UPDATE " + scoreTable + " SET tempo_ms = ?, data_giocata = NOW() WHERE id_utente = ? AND id_circuito = ?";
                        try (PreparedStatement psUpdate = conn.prepareStatement(updateSql)) {
                            psUpdate.setLong(1, tempoMs);
                            psUpdate.setInt(2, idUtente);
                            psUpdate.setInt(3, idCircuito);
                            psUpdate.executeUpdate();
                            System.out.println("🏆 Nuovo record: " + tempoMs + "ms (precedente: " + recordAttuale + "ms)");
                            return 1;
                        }
                    } else {
                        System.out.println("ℹ️ Tempo non aggiornato: " + tempoMs + "ms <= " + recordAttuale + "ms");
                        return 2;
                    }
                } else {
                    String insertSql = "INSERT INTO " + scoreTable + " (id_utente, id_circuito, tempo_ms, data_giocata) VALUES (?, ?, ?, NOW())";
                    try (PreparedStatement psInsert = conn.prepareStatement(insertSql)) {
                        psInsert.setInt(1, idUtente);
                        psInsert.setInt(2, idCircuito);
                        psInsert.setLong(3, tempoMs);
                        psInsert.executeUpdate();
                        System.out.println("✅ Primo score inserito: " + tempoMs + "ms");
                        return 0;
                    }
                }
            }

        } catch (SQLException e) {
            System.out.println("❌ Errore ScoreDAO: " + e.getMessage());
            throw e;
        }
    }
}