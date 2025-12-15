import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

const ToolsImprovements = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  useEffect(() => {
    // Redirect legacy ferramentas route to quality page
    navigate(`/qualidade-codigo/${id}`, { replace: true });
  }, [navigate, id]);

  return null;
};

export default ToolsImprovements;
