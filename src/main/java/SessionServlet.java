import java.io.IOException;
import java.io.PrintWriter;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

@WebServlet("/Session")
public class SessionServlet extends HttpServlet {
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        PrintWriter out = response.getWriter();

        HttpSession session = request.getSession(false);
        if (session != null && session.getAttribute("userId") != null) {
            int    userId  = (int)    session.getAttribute("userId");
            String nakName = (String) session.getAttribute("nakName");
            String email   = (String) session.getAttribute("email");
            out.print("{\"loggedIn\":true,\"userId\":" + userId + 
                      ",\"nakName\":\"" + nakName + "\"" +
                      ",\"email\":\"" + email + "\"}");
        } else {
            out.print("{\"loggedIn\":false}");
        }
    }
}