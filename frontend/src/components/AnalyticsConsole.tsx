import React from 'react';
import Chart from 'react-apexcharts';

interface Complaint {
  id: number;
  title: string;
  category: string;
  severity: string;
  status: string;
  description: string;
  upvotes: number;
  hasUpvoted: boolean;
  reach: number;
  disruption: number;
  gpi: number;
  authorName: string;
  authorEmail: string;
  createdAt: string;
}

interface AnalyticsConsoleProps {
  complaints: Complaint[];
}

export const AnalyticsConsole: React.FC<AnalyticsConsoleProps> = ({ complaints }) => {
  // Category donut chart calculations
  const getCategoryChartData = () => {
    const counts: Record<string, number> = {
      hostel: 0,
      mess: 0,
      academic: 0,
      it_services: 0,
      electricity: 0,
      plumbing: 0,
      security: 0,
      other: 0,
    };

    complaints.forEach((c) => {
      const cat = c.category;
      if (counts[cat] !== undefined) {
        counts[cat]++;
      } else {
        counts.other++;
      }
    });

    return {
      series: Object.values(counts),
      labels: Object.keys(counts).map((k) => k.toUpperCase().replace('_', ' ')),
    };
  };

  // Urgency status bar chart calculations
  const getUrgencyChartData = () => {
    const pending: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    const resolved: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };

    complaints.forEach((c) => {
      const isFinished = c.status === 'resolved' || c.status === 'closed';
      const sev = c.severity.toLowerCase();
      if (isFinished) {
        if (resolved[sev] !== undefined) {
          resolved[sev]++;
        }
      } else {
        if (pending[sev] !== undefined) {
          pending[sev]++;
        }
      }
    });

    return {
      pending: [pending.critical, pending.high, pending.medium, pending.low],
      resolved: [resolved.critical, resolved.high, resolved.medium, resolved.low],
    };
  };

  const catData = getCategoryChartData();
  const catOptions: ApexCharts.ApexOptions = {
    chart: {
      type: 'donut',
      background: 'transparent',
      foreColor: '#94a3b8',
      toolbar: { show: false },
    },
    stroke: { show: false },
    labels: catData.labels,
    colors: ['#4FACFE', '#F7971E', '#7F00FF', '#00F2FE', '#00FF87', '#FF007F', '#e2e8f0', '#94a3b8'],
    theme: { mode: 'dark' },
    legend: { position: 'bottom' },
    dataLabels: { enabled: false },
    plotOptions: {
      pie: {
        donut: {
          size: '72%',
          background: 'transparent',
          labels: {
            show: true,
            name: { show: true, fontSize: '13px', fontFamily: 'Outfit' },
            value: {
              show: true,
              fontSize: '20px',
              fontFamily: 'Outfit',
              fontWeight: 'bold',
              color: '#ffffff',
            },
            total: {
              show: true,
              label: 'Active Outages',
              color: '#64748b',
              formatter: () => String(complaints.length),
            },
          },
        },
      },
    },
  };

  const urgData = getUrgencyChartData();
  const urgOptions: ApexCharts.ApexOptions = {
    chart: {
      type: 'bar',
      background: 'transparent',
      foreColor: '#94a3b8',
      toolbar: { show: false },
    },
    theme: { mode: 'dark' },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '55%',
        borderRadius: 5,
      },
    },
    stroke: { show: false },
    dataLabels: { enabled: false },
    xaxis: {
      categories: ['Critical', 'High', 'Medium', 'Low'],
    },
    colors: ['#F7971E', '#00FF87'],
    legend: { position: 'top' },
    grid: { borderColor: 'rgba(255, 255, 255, 0.03)' },
  };

  const urgSeries = [
    { name: 'Active Outages', data: urgData.pending },
    { name: 'Resolved Fixes', data: urgData.resolved },
  ];

  return (
    <div id="tab-analytics" className="tab-content active">
      <div className="tab-header-minimal">
        <h2>Administrative Insights Console</h2>
        <p>Live crowdsourced analytics driven by the mathematical GIKI Priority Index (GPI).</p>
      </div>

      <div className="analytics-layout">
        <div className="glass-card chart-card">
          <h3>Active Outages by Sector</h3>
          <div id="chart-categories" style={{ minHeight: '280px' }}>
            <Chart options={catOptions} series={catData.series} type="donut" height={280} />
          </div>
        </div>
        <div className="glass-card chart-card">
          <h3>GPI Score Density & Urgency Weight</h3>
          <div id="chart-status-urgency" style={{ minHeight: '280px' }}>
            <Chart options={urgOptions} series={urgSeries} type="bar" height={280} />
          </div>
        </div>
      </div>
    </div>
  );
};
