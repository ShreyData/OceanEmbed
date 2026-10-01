import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ExplorePage() {
  const navigate = useNavigate();
  useEffect(() => { navigate('/input', { replace: true }); }, [navigate]);
  return null;
}
