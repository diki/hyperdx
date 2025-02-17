import * as React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import cx from 'classnames';
import { formatRelative } from 'date-fns';
import { ArrayParam, useQueryParam, withDefault } from 'use-query-params';
import {
  Alert as MAlert,
  Badge,
  Button,
  Container,
  Divider,
  Group,
  Stack,
  Tooltip,
} from '@mantine/core';

import api from './api';
import { withAppNav } from './layout';
import { Tags } from './Tags';
import type { Alert, AlertHistory, LogView } from './types';
import { AlertState } from './types';

import styles from '../styles/AlertsPage.module.scss';

type AlertData = Alert & {
  history: AlertHistory[];
  dashboard?: {
    _id: string;
    name: string;
    charts: { id: string; name: string }[];
    tags?: string[];
  };
  logView?: LogView;
};

const DISABLE_ALERTS_ENABLED = false;

function AlertHistoryCard({ history }: { history: AlertHistory }) {
  const start = new Date(history.createdAt.toString());
  const today = React.useMemo(() => new Date(), []);
  const latestHighestValue = history.lastValues.length
    ? Math.max(...history.lastValues.map(({ count }) => count))
    : 0;
  return (
    <Tooltip
      label={latestHighestValue + ' ' + formatRelative(start, today)}
      color="dark"
      withArrow
    >
      <div
        className={cx(
          styles.historyCard,
          history.state === AlertState.OK ? styles.ok : styles.alarm,
        )}
      />
    </Tooltip>
  );
}

const HISTORY_ITEMS = 18;

function AlertHistoryCardList({ history }: { history: AlertHistory[] }) {
  const items = React.useMemo(() => {
    if (history.length < HISTORY_ITEMS) {
      return history;
    }
    return history.slice(0, HISTORY_ITEMS);
  }, [history]);

  const paddingItems = React.useMemo(() => {
    if (history.length > HISTORY_ITEMS) {
      return [];
    }
    return new Array(HISTORY_ITEMS - history.length).fill(null);
  }, [history]);

  return (
    <div className={styles.historyCardWrapper}>
      {paddingItems.map((_, index) => (
        <Tooltip label="No data" color="dark" withArrow key={index}>
          <div className={styles.historyCard} />
        </Tooltip>
      ))}
      {items.reverse().map((history, index) => (
        <AlertHistoryCard key={index} history={history} />
      ))}
    </div>
  );
}

function disableAlert(alertId?: string) {
  if (!alertId) {
    return; // no ID yet to disable?
  }
  // TODO do some lovely disabling of the alert here
}

function AlertDetails({ alert }: { alert: AlertData }) {
  const alertName = React.useMemo(() => {
    if (alert.source === 'CHART' && alert.dashboard) {
      const chartName = alert.dashboard.charts.find(
        chart => chart.id === alert.chartId,
      )?.name;
      return (
        <>
          {alert.dashboard.name}
          {chartName ? (
            <>
              <i className="bi bi-chevron-right fs-8 mx-1 text-slate-400" />
              {chartName}
            </>
          ) : null}
        </>
      );
    }
    if (alert.source === 'LOG' && alert.logView) {
      return alert.logView?.name;
    }
    return '–';
  }, [alert]);

  const alertUrl = React.useMemo(() => {
    if (alert.source === 'CHART' && alert.dashboard) {
      return `/dashboards/${alert.dashboard._id}?highlightedChartId=${alert.chartId}`;
    }
    if (alert.source === 'LOG' && alert.logView) {
      return `/search/${alert.logView._id}`;
    }
    return '';
  }, [alert]);

  return (
    <div className={styles.alertRow}>
      <Group>
        {alert.state === AlertState.ALERT && (
          <Badge color="red" size="sm">
            Alert
          </Badge>
        )}
        {alert.state === AlertState.OK && <Badge size="sm">Ok</Badge>}
        {alert.state === AlertState.DISABLED && (
          <Badge color="gray" size="sm">
            Disabled
          </Badge>
        )}

        <Stack spacing={2}>
          <div>
            <Link href={alertUrl}>
              <a
                className={styles.alertLink}
                title={
                  alert.source === 'CHART' ? 'Dashboard chart' : 'Saved search'
                }
              >
                <i
                  className={`bi ${
                    alert.source === 'CHART'
                      ? 'bi-graph-up'
                      : 'bi-layout-text-sidebar-reverse'
                  } text-slate-200 me-2 fs-8`}
                />
                {alertName}
              </a>
            </Link>
          </div>
          <div className="text-slate-400 fs-8 d-flex gap-2">
            If {alert.source === 'LOG' ? 'count' : 'value'} is{' '}
            {alert.type === 'presence' ? 'over' : 'under'}{' '}
            <span className="fw-bold">{alert.threshold}</span>
            <span className="text-slate-400">&middot;</span>
            {alert.channel.type === 'webhook' && (
              <span>Notify via Slack Webhook</span>
            )}
          </div>
        </Stack>
      </Group>

      <Group>
        <AlertHistoryCardList history={alert.history} />
        {/* can we disable an alert that is alarming? hmmmmm */}
        {/* also, will make the alert jump from under the cursor to the disabled area */}
        {DISABLE_ALERTS_ENABLED ? (
          <Button
            size="xs"
            compact
            color="gray"
            onClick={() => {
              disableAlert(alert._id);
            }}
          >
            Disable
          </Button>
        ) : null}
      </Group>
    </div>
  );
}

function AlertCardList({ alerts }: { alerts: AlertData[] }) {
  const alarmAlerts = alerts.filter(alert => alert.state === AlertState.ALERT);
  const okData = alerts.filter(alert => alert.state === AlertState.OK);
  const disabledData = alerts.filter(
    alert =>
      alert.state === AlertState.DISABLED ||
      alert.state === AlertState.INSUFFICIENT_DATA,
  );

  return (
    <div className="d-flex flex-column gap-4">
      {alarmAlerts.length > 0 && (
        <div>
          <div className={styles.sectionHeader}>
            <i className="bi bi-exclamation-triangle"></i> Triggered
          </div>
          {alarmAlerts.map((alert, index) => (
            <AlertDetails key={index} alert={alert} />
          ))}
        </div>
      )}
      <div>
        <div className={styles.sectionHeader}>
          <i className="bi bi-check-lg"></i> OK
        </div>
        {okData.length === 0 && (
          <div className="text-center text-slate-400 my-4 fs-8">No alerts</div>
        )}
        {okData.map((alert, index) => (
          <AlertDetails key={index} alert={alert} />
        ))}
      </div>
      {DISABLE_ALERTS_ENABLED && (
        <div>
          <div className={styles.sectionHeader}>
            <i className="bi bi-stop"></i> Disabled
          </div>
          {disabledData.length === 0 && (
            <div className="text-center text-slate-400 my-4 fs-8">
              No alerts
            </div>
          )}
          {disabledData.map((alert, index) => (
            <AlertDetails key={index} alert={alert} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AlertsPage() {
  const { data, isError, isLoading } = api.useAlerts();
  const alerts = React.useMemo(
    () => (data?.data || []) as AlertData[],
    [data?.data],
  );

  // TODO: Error and loading states

  const [_tags, setTags] = useQueryParam(
    'tags',
    withDefault(ArrayParam, [] as (string | null)[]),
    { updateType: 'replaceIn' },
  );
  const tags = React.useMemo(() => _tags.filter(Boolean) as string[], [_tags]);

  const filteredAlerts = React.useMemo(() => {
    if (!tags.length) {
      return alerts;
    }
    return alerts.filter(alert =>
      [...(alert.dashboard?.tags || []), ...(alert.logView?.tags || [])].some(
        tag => tags.includes(tag),
      ),
    );
  }, [tags, alerts]);

  return (
    <div className="AlertsPage">
      <Head>
        <title>Alerts - HyperDX</title>
      </Head>
      <div className={styles.header}>Alerts</div>
      <div className="my-4">
        <Container>
          <MAlert
            icon={<i className="bi bi-info-circle-fill text-slate-400" />}
            color="gray"
          >
            Alerts can be{' '}
            <a
              href="https://www.hyperdx.io/docs/alerts"
              target="_blank"
              rel="noopener noreferrer"
            >
              created
            </a>{' '}
            from dashboard charts and saved searches.
          </MAlert>
          {isLoading ? (
            <div className="text-center text-slate-400 my-4 fs-8">
              Loading...
            </div>
          ) : isError ? (
            <div className="text-center text-slate-400 my-4 fs-8">Error</div>
          ) : alerts?.length ? (
            <>
              <Button.Group mt="xl">
                <Tags values={tags} onChange={setTags}>
                  <Button
                    size="xs"
                    variant="default"
                    leftIcon={
                      <i
                        className={cx(
                          'bi bi-funnel-fill',
                          tags.length ? 'text-success' : 'text-slate-400',
                        )}
                      />
                    }
                  >
                    {tags.length ? (
                      <>
                        <span className="text-slate-400 me-1">Tags </span>
                        {tags?.join(', ')}
                      </>
                    ) : (
                      <span className="text-slate-400">Filter by Tags</span>
                    )}
                  </Button>
                </Tags>
                {tags.length > 0 && (
                  <Button
                    size="xs"
                    variant="default"
                    onClick={() => setTags([])}
                    px="xs"
                  >
                    <i className="bi bi-x-lg" />
                  </Button>
                )}
              </Button.Group>
              <AlertCardList alerts={filteredAlerts} />
            </>
          ) : (
            <div className="text-center text-slate-400 my-4 fs-8">
              No alerts created yet
            </div>
          )}
        </Container>
      </div>
    </div>
  );
}

AlertsPage.getLayout = withAppNav;
