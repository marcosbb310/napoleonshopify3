-- Materialized view for fast product performance queries
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_product_performance AS
SELECT 
  p.id as product_id,
  p.store_id,
  p.title,
  p.current_price,
  p.starting_price,
  COALESCE(SUM(sd.revenue), 0) as revenue_30d,
  COALESCE(SUM(sd.units_sold), 0) as units_30d,
  COALESCE(AVG(sd.revenue), 0) as avg_daily_revenue,
  COALESCE(pa.performance_score, 0) as performance_score,
  pa.revenue_trend,
  p.last_analytics_update
FROM products p
LEFT JOIN sales_data sd ON p.id = sd.product_id 
  AND sd.date >= CURRENT_DATE - INTERVAL '30 days'
LEFT JOIN product_analytics pa ON p.id = pa.product_id
GROUP BY p.id, p.store_id, p.title, p.current_price, p.starting_price, 
         pa.performance_score, pa.revenue_trend, p.last_analytics_update;

CREATE UNIQUE INDEX idx_mv_product_performance_id ON mv_product_performance(product_id);
CREATE INDEX idx_mv_product_performance_store ON mv_product_performance(store_id);
CREATE INDEX idx_mv_product_performance_score ON mv_product_performance(performance_score DESC NULLS LAST);

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_product_performance_view()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_product_performance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION refresh_product_performance_view() TO service_role;
