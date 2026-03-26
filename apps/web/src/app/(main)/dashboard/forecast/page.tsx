import { fetchForecastPage } from '@/features/forecast/services/fetchForecastPage';
import { ForecastPageView } from '@/features/forecast/components/ForecastPageView';

export default async function ForecastPage() {
  const data = await fetchForecastPage();

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-zinc-100">Forecast</h1>
        <p className="mt-1 text-xs text-zinc-500">
          Schedule projections, burn rate analysis, and critical path tracking.
        </p>
      </div>
      <ForecastPageView data={data} />
    </div>
  );
}
