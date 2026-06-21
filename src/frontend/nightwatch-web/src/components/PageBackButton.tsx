import { useNavigate } from 'react-router-dom';

export function PageBackButton() {
  const navigate = useNavigate();

  return (
    <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-100 text-sm">
      ← Back
    </button>
  );
}
