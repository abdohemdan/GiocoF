import java.io.IOException;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

@WebServlet("/GoogleLogin")
public class GoogleLoginServlet extends HttpServlet {

    private static final String CLIENT_ID     = "288750040588-hsq2eth0pdue8atftbds0ri20gb6fa95.apps.googleusercontent.com";
    private static final String REDIRECT_URI  = "http://localhost:8080/GoogleCallback";
    private static final String SCOPE         = "openid email profile";

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        String redirectParam = request.getParameter("redirect");
        String state = (redirectParam != null && !redirectParam.trim().isEmpty())
            ? java.net.URLEncoder.encode(redirectParam.trim(), "UTF-8")
            : "";

        String authUrl = "https://accounts.google.com/o/oauth2/v2/auth"
                + "?client_id="     + CLIENT_ID
                + "&redirect_uri="  + java.net.URLEncoder.encode(REDIRECT_URI, "UTF-8")
                + "&response_type=code"
                + "&scope="         + java.net.URLEncoder.encode(SCOPE, "UTF-8")
                + "&access_type=offline"
                + "&prompt=select_account"
                + (state.isEmpty() ? "" : "&state=" + state);

        response.sendRedirect(authUrl);
    }
}