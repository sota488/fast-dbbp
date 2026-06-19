import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import Page from './page';
import { SESSION_SUMMARIES_STORAGE_KEY, type SessionSummary } from './sessionSummaryStorage';

function clickButton(container: HTMLElement, label: string): void {
  const button = Array.from(container.querySelectorAll('button')).find((node) => node.textContent?.trim() === label);
  if (!button) {
    throw new Error(`button not found: ${label}`);
  }

  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function buildSummary(index: number): SessionSummary {
  return {
    id: `session-${index}`,
    completedAt: `2026-06-${String(index).padStart(2, '0')}T00:00:00.000Z`,
    handsPlayed: 100,
    avgFastFoldMs: 120 + index,
    bestFastFoldMs: 80 + index,
    p50FastFoldMs: 110 + index,
    p95FastFoldMs: 150 + index,
    p99FastFoldMs: 170 + index,
    maxFastFoldMs: 190 + index,
  };
}

function buildSummaryAt(index: number, completedAt: string): SessionSummary {
  return {
    ...buildSummary(index),
    completedAt,
  };
}

function freezeDate(isoNow: string): jest.SpyInstance<number, []> {
  const fixedMs = new Date(isoNow).getTime();
  return jest.spyOn(Date, 'now').mockImplementation(() => fixedMs);
}

describe('Fast Fold success E2E', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('shows empty state when session history is empty', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    act(() => {
      root.render(React.createElement(Page));
    });

    const text = container.textContent ?? '';
    expect(text).toContain('Fast DBBP');
    expect(text).toContain('Play Now');
    expect(text).toContain('Session History');
    expect(text).toContain('Start your first session');
    expect(text).toContain('Play 100 hands on Fast DBBP and your progress will appear here.');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('shows 3 history cards when localStorage has 3 sessions', () => {
    const sessions = [buildSummary(1), buildSummary(2), buildSummary(3)];
    window.localStorage.setItem(SESSION_SUMMARIES_STORAGE_KEY, JSON.stringify(sessions));

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    act(() => {
      root.render(React.createElement(Page));
    });

    const cards = container.querySelectorAll('[aria-label="Session History Item"]');
    expect(cards).toHaveLength(3);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('shows only latest 5 history cards when localStorage has 10 sessions', () => {
    const sessions = Array.from({ length: 10 }, (_, index) => buildSummary(index + 1));
    window.localStorage.setItem(SESSION_SUMMARIES_STORAGE_KEY, JSON.stringify(sessions));

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    act(() => {
      root.render(React.createElement(Page));
    });

    const cards = container.querySelectorAll('[aria-label="Session History Item"]');
    expect(cards).toHaveLength(5);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('shows value cards for first-time landing understanding', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    act(() => {
      root.render(React.createElement(Page));
    });

    const text = container.textContent ?? '';
    expect(text).toContain('Fast Practice');
    expect(text).toContain('Track Progress');
    expect(text).toContain('Build Habits');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('shows daily goal card with start copy at 0 hands', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    act(() => {
      root.render(React.createElement(Page));
    });

    const text = container.textContent ?? '';
    expect(text).toContain("Today's Goal");
    expect(text).toContain('0 / 100 Hands');
    expect(text).toContain("Let's get started.");

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('shows daily goal halfway copy at 50 hands', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    const nowSpy = jest.spyOn(Date, 'now');
    let now = 20000;
    nowSpy.mockImplementation(() => {
      now += 7;
      return now;
    });

    act(() => {
      root.render(React.createElement(Page));
    });

    clickButton(container, 'Play Now');
    for (let i = 0; i < 50; i += 1) {
      clickButton(container, 'Fold');
    }
    clickButton(container, 'Back Home');

    const text = container.textContent ?? '';
    expect(text).toContain('50 / 100 Hands');
    expect(text).toContain('Halfway there.');

    act(() => {
      root.unmount();
    });
    container.remove();
    nowSpy.mockRestore();
  });

  it('shows daily goal completed copy at 100 hands', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    const nowSpy = jest.spyOn(Date, 'now');
    let now = 30000;
    nowSpy.mockImplementation(() => {
      now += 7;
      return now;
    });

    act(() => {
      root.render(React.createElement(Page));
    });

    clickButton(container, 'Play Now');
    for (let i = 0; i < 100; i += 1) {
      clickButton(container, 'Fold');
    }
    clickButton(container, 'Close');
    clickButton(container, 'Back Home');

    const text = container.textContent ?? '';
    expect(text).toContain('100 / 100 Hands');
    expect(text).toContain('Goal completed 🎉');

    act(() => {
      root.unmount();
    });
    container.remove();
    nowSpy.mockRestore();
  });

  it('shows streak start copy when there are no sessions', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    act(() => {
      root.render(React.createElement(Page));
    });

    const text = container.textContent ?? '';
    expect(text).toContain('🔥 Streak');
    expect(text).toContain('Start your streak.');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('shows 1 Day Streak when only yesterday session exists', () => {
    const dateNowSpy = freezeDate('2026-07-10T09:00:00.000Z');

    window.localStorage.setItem(
      SESSION_SUMMARIES_STORAGE_KEY,
      JSON.stringify([buildSummaryAt(1, '2026-07-09T12:00:00.000Z')]),
    );

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    act(() => {
      root.render(React.createElement(Page));
    });

    const text = container.textContent ?? '';
    expect(text).toContain('1日');
    expect(text).toContain('1 Day Streak');

    act(() => {
      root.unmount();
    });
    container.remove();
    dateNowSpy.mockRestore();
  });

  it('shows 3 Day Streak when there are sessions on today, yesterday, and 2 days ago', () => {
    const dateNowSpy = freezeDate('2026-07-10T09:00:00.000Z');

    const sessions = [
      buildSummaryAt(1, '2026-07-10T02:00:00.000Z'),
      buildSummaryAt(2, '2026-07-09T02:00:00.000Z'),
      buildSummaryAt(3, '2026-07-08T02:00:00.000Z'),
    ];
    window.localStorage.setItem(SESSION_SUMMARIES_STORAGE_KEY, JSON.stringify(sessions));

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    act(() => {
      root.render(React.createElement(Page));
    });

    const text = container.textContent ?? '';
    expect(text).toContain('3日');
    expect(text).toContain('3 Day Streak');

    act(() => {
      root.unmount();
    });
    container.remove();
    dateNowSpy.mockRestore();
  });

  it('resets streak when day continuity is missing', () => {
    const dateNowSpy = freezeDate('2026-07-10T09:00:00.000Z');

    const sessions = [
      buildSummaryAt(1, '2026-07-10T02:00:00.000Z'),
      buildSummaryAt(2, '2026-07-08T02:00:00.000Z'),
    ];
    window.localStorage.setItem(SESSION_SUMMARIES_STORAGE_KEY, JSON.stringify(sessions));

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    act(() => {
      root.render(React.createElement(Page));
    });

    const text = container.textContent ?? '';
    expect(text).toContain('1日');
    expect(text).toContain('1 Day Streak');
    expect(text).not.toContain('2 Day Streak');

    act(() => {
      root.unmount();
    });
    container.remove();
    dateNowSpy.mockRestore();
  });

  it('shows history in newest-first order', () => {
    const sessions = [buildSummary(1), buildSummary(2), buildSummary(3)];
    window.localStorage.setItem(SESSION_SUMMARIES_STORAGE_KEY, JSON.stringify(sessions));

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    act(() => {
      root.render(React.createElement(Page));
    });

    const cards = Array.from(container.querySelectorAll('[aria-label="Session History Item"]'));
    expect(cards).toHaveLength(3);
    expect(cards[0].textContent ?? '').toContain('Avg DBBP123ms');
    expect(cards[1].textContent ?? '').toContain('Avg DBBP122ms');
    expect(cards[2].textContent ?? '').toContain('Avg DBBP121ms');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('shows comparison pending message when there is only one session', () => {
    const sessions = [buildSummary(3)];
    window.localStorage.setItem(SESSION_SUMMARIES_STORAGE_KEY, JSON.stringify(sessions));

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    act(() => {
      root.render(React.createElement(Page));
    });

    const text = container.textContent ?? '';
    expect(text).toContain('Your Progress');
    expect(text).toContain('Play one more session to compare.');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('shows faster labels when latest session improved', () => {
    const previous = {
      ...buildSummary(1),
      completedAt: '2026-06-10T00:00:00.000Z',
      avgFastFoldMs: 142,
      bestFastFoldMs: 97,
    };
    const current = {
      ...buildSummary(2),
      completedAt: '2026-06-11T00:00:00.000Z',
      avgFastFoldMs: 124,
      bestFastFoldMs: 91,
    };
    window.localStorage.setItem(SESSION_SUMMARIES_STORAGE_KEY, JSON.stringify([previous, current]));

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    act(() => {
      root.render(React.createElement(Page));
    });

    const text = container.textContent ?? '';
    expect(text).toContain('Your Progress');
    expect(text).toContain('Sessions Completed');
    expect(text).toContain('Hands Played');
    expect(text).toContain('Current Streak');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('shows slower labels when latest session regressed', () => {
    const previous = {
      ...buildSummary(1),
      completedAt: '2026-06-10T00:00:00.000Z',
      avgFastFoldMs: 124,
      bestFastFoldMs: 91,
    };
    const current = {
      ...buildSummary(2),
      completedAt: '2026-06-11T00:00:00.000Z',
      avgFastFoldMs: 136,
      bestFastFoldMs: 101,
    };
    window.localStorage.setItem(SESSION_SUMMARIES_STORAGE_KEY, JSON.stringify([previous, current]));

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    act(() => {
      root.render(React.createElement(Page));
    });

    const text = container.textContent ?? '';
    expect(text).toContain('Sessions Completed');
    expect(text).toContain('Hands Played');
    expect(text).toContain('Current Streak');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('shows no change labels when latest session is unchanged', () => {
    const previous = {
      ...buildSummary(1),
      completedAt: '2026-06-10T00:00:00.000Z',
      avgFastFoldMs: 124,
      bestFastFoldMs: 91,
    };
    const current = {
      ...buildSummary(2),
      completedAt: '2026-06-11T00:00:00.000Z',
      avgFastFoldMs: 124,
      bestFastFoldMs: 91,
    };
    window.localStorage.setItem(SESSION_SUMMARIES_STORAGE_KEY, JSON.stringify([previous, current]));

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    act(() => {
      root.render(React.createElement(Page));
    });

    const text = container.textContent ?? '';
    expect(text).toContain('No change');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('shows how it works card with onboarding steps', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    act(() => {
      root.render(React.createElement(Page));
    });

    const text = container.textContent ?? '';
    expect(text).toContain('How It Works');
    expect(text).toContain('Start a hand');
    expect(text).toContain('Fold instantly');
    expect(text).toContain('Repeat until 100 hands');
    expect(text).toContain('Review your progress');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('Join Queue -> Start Hand -> Fold -> Queue reassignment -> Start Hand -> PLAYING', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    const nowSpy = jest.spyOn(Date, 'now');
    let now = 1000;
    nowSpy.mockImplementation(() => {
      now += 7;
      return now;
    });

    act(() => {
      root.render(React.createElement(Page));
    });

    clickButton(container, 'Play Now');

    const actingBeforeFold = container.textContent ?? '';
    expect(actingBeforeFold).toContain('Acting:');
    expect(actingBeforeFold).not.toContain('Acting: -');

    clickButton(container, 'Fold');

    const text = container.textContent ?? '';

    expect(text).toContain('✨ Next Hand Ready');
    expect(text).toContain('State');
    expect(text).toContain('Measured Metrics');
    expect(text).toContain('Hands Today');
    expect(text).toContain('Daily Goal');
    expect(text).toContain('Progress %');
    expect(text).toContain('Progress');
    expect(text).toMatch(/\d+%/);
    expect(text).toContain('詳細を見る');
    expect(text).not.toContain('Not acting player');
    expect(text).not.toContain('DUPLICATE_DEDUPE_KEY');

    const match = text.match(/(\d+(?:\.\d+)?)ms/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeGreaterThanOrEqual(0);

    act(() => {
      root.unmount();
    });
    container.remove();
    nowSpy.mockRestore();
  });

  it('shows session complete modal only once at 100 hands', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    const nowSpy = jest.spyOn(Date, 'now');
    let now = 5000;
    nowSpy.mockImplementation(() => {
      now += 7;
      return now;
    });

    act(() => {
      root.render(React.createElement(Page));
    });

    clickButton(container, 'Play Now');

    for (let i = 0; i < 99; i += 1) {
      clickButton(container, 'Fold');
    }

    expect(container.textContent ?? '').not.toContain('🎉 100 Hands Complete!');

    clickButton(container, 'Fold');

    const at100 = container.textContent ?? '';
    expect(at100).toContain('🎉 100 Hands Complete!');
    expect(at100).toContain('Hands Played');
    expect(at100).toContain('Daily Goal Progress');
    expect(at100).toContain('Current Streak');
    expect(at100).toContain('100');
    expect(at100).toContain('Close');

    clickButton(container, 'Close');
    expect(container.textContent ?? '').not.toContain('🎉 100 Hands Complete!');

    clickButton(container, 'Fold');
    expect(container.textContent ?? '').not.toContain('🎉 100 Hands Complete!');

    act(() => {
      root.unmount();
    });
    container.remove();
    nowSpy.mockRestore();
  });

  it('saves one session summary to localStorage when 100 hands are reached', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    const nowSpy = jest.spyOn(Date, 'now');
    let now = 9000;
    nowSpy.mockImplementation(() => {
      now += 7;
      return now;
    });

    act(() => {
      root.render(React.createElement(Page));
    });

    clickButton(container, 'Play Now');

    for (let i = 0; i < 100; i += 1) {
      clickButton(container, 'Fold');
    }

    const raw = window.localStorage.getItem(SESSION_SUMMARIES_STORAGE_KEY);
    expect(raw).not.toBeNull();

    const saved = JSON.parse(raw ?? '[]') as SessionSummary[];
    expect(saved).toHaveLength(1);
    expect(saved[0].handsPlayed).toBe(100);
    expect(saved[0].avgFastFoldMs).toBeGreaterThanOrEqual(0);
    expect(saved[0].bestFastFoldMs).toBeGreaterThanOrEqual(0);

    act(() => {
      root.unmount();
    });
    container.remove();
    nowSpy.mockRestore();
  });

  it('does not save duplicate summary in same session after closing modal and folding again', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    const nowSpy = jest.spyOn(Date, 'now');
    let now = 12000;
    nowSpy.mockImplementation(() => {
      now += 7;
      return now;
    });

    act(() => {
      root.render(React.createElement(Page));
    });

    clickButton(container, 'Play Now');

    for (let i = 0; i < 100; i += 1) {
      clickButton(container, 'Fold');
    }

    clickButton(container, 'Close');
    clickButton(container, 'Fold');

    const raw = window.localStorage.getItem(SESSION_SUMMARIES_STORAGE_KEY);
    const saved = JSON.parse(raw ?? '[]') as SessionSummary[];
    expect(saved).toHaveLength(1);

    act(() => {
      root.unmount();
    });
    container.remove();
    nowSpy.mockRestore();
  });

  it('keeps only 30 latest session summaries when saving the 31st', () => {
    const existing: SessionSummary[] = Array.from({ length: 30 }, (_, index) => ({
      id: `old-${index + 1}`,
      completedAt: `2026-06-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
      handsPlayed: 100,
      avgFastFoldMs: 200 + index,
      bestFastFoldMs: 100 + index,
      p50FastFoldMs: 180 + index,
      p95FastFoldMs: 240 + index,
      p99FastFoldMs: 260 + index,
      maxFastFoldMs: 300 + index,
    }));
    window.localStorage.setItem(SESSION_SUMMARIES_STORAGE_KEY, JSON.stringify(existing));

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    const nowSpy = jest.spyOn(Date, 'now');
    let now = 15000;
    nowSpy.mockImplementation(() => {
      now += 7;
      return now;
    });

    act(() => {
      root.render(React.createElement(Page));
    });

    clickButton(container, 'Play Now');
    for (let i = 0; i < 100; i += 1) {
      clickButton(container, 'Fold');
    }

    const raw = window.localStorage.getItem(SESSION_SUMMARIES_STORAGE_KEY);
    const saved = JSON.parse(raw ?? '[]') as SessionSummary[];

    expect(saved).toHaveLength(30);
    expect(saved[0].handsPlayed).toBe(100);
    expect(saved.some((item) => item.id === 'old-30')).toBe(false);

    act(() => {
      root.unmount();
    });
    container.remove();
    nowSpy.mockRestore();
  });
});
