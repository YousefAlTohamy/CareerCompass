global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: backend
    metrics_path: /api/v1/metrics
    bearer_token: __MONITORING_TOKEN__
    static_configs:
      - targets: ['nginx:80']

  - job_name: ai-cv-analyzer
    metrics_path: /metrics
    static_configs:
      - targets: ['ai-cv-analyzer:8000']

  - job_name: ai-job-miner
    metrics_path: /metrics
    static_configs:
      - targets: ['ai-job-miner:8000']
