import { describe, expect, it } from 'vitest';

import {
  BET_RADIUS_RATIO,
  LOCAL_SEAT_ANGLE,
  TRICK_RADIUS_RATIO,
  localSeat,
  opponentSeats,
  seatMap,
  seatScale,
} from '../src/ui/casino/seating';
import type { Seat } from '../src/ui/casino/seating';

const distancia = (a: Seat, b: Seat) => Math.hypot(a.x - b.x, a.y - b.y);

describe('assento do jogador local', () => {
  const eu = localSeat();

  it('fica na base da mesa, centralizado', () => {
    expect(eu.angle).toBe(LOCAL_SEAT_ANGLE);
    expect(eu.x).toBeCloseTo(50, 6);
    expect(eu.y).toBeGreaterThan(80);
  });

  it('aponta para baixo — a direção usada pelas animações', () => {
    expect(eu.dirX).toBeCloseTo(0, 6);
    expect(eu.dirY).toBeCloseTo(1, 6);
  });
});

describe('assentos dos adversários', () => {
  it('mesa vazia não tem assento', () => {
    expect(opponentSeats(0)).toEqual([]);
  });

  it('um adversário senta em frente, no topo', () => {
    const [seat] = opponentSeats(1);
    expect(seat!.angle).toBe(270);
    expect(seat!.x).toBeCloseTo(50, 6);
    expect(seat!.y).toBeLessThan(20);
  });

  it('três adversários ficam em 210°, 270° e 330°', () => {
    expect(opponentSeats(3).map((s) => s.angle)).toEqual([210, 270, 330]);
  });

  it('sete adversários se espalham de 180° a 360°', () => {
    const angles = opponentSeats(7).map((s) => s.angle);
    expect(angles).toHaveLength(7);
    expect(angles[0]).toBe(180);
    expect(angles[6]).toBe(360);
    // Espaçamento constante ao longo do arco.
    for (let i = 1; i < angles.length; i++) {
      expect(angles[i]! - angles[i - 1]!).toBeCloseTo(30, 6);
    }
  });

  it.each([1, 2, 3, 4, 5, 6, 7])('com %i adversários nada sai do contêiner', (n) => {
    for (const seat of opponentSeats(n)) {
      expect(seat.x).toBeGreaterThanOrEqual(0);
      expect(seat.x).toBeLessThanOrEqual(100);
      expect(seat.y).toBeGreaterThanOrEqual(0);
      expect(seat.y).toBeLessThanOrEqual(100);
    }
  });

  it.each([1, 2, 3, 4, 5, 6, 7])('com %i adversários ninguém senta em cima de ninguém', (n) => {
    const todos = [localSeat(), ...opponentSeats(n)];
    for (let i = 0; i < todos.length; i++) {
      for (let j = i + 1; j < todos.length; j++) {
        expect(distancia(todos[i]!, todos[j]!)).toBeGreaterThan(9);
      }
    }
  });

  it('nenhum adversário invade a base, que é do jogador local', () => {
    for (const seat of opponentSeats(7)) {
      expect(distancia(seat, localSeat())).toBeGreaterThan(20);
    }
  });

  it('a direção é sempre um vetor unitário', () => {
    for (const seat of opponentSeats(6)) {
      expect(Math.hypot(seat.dirX, seat.dirY)).toBeCloseTo(1, 6);
    }
  });
});

describe('raios de fichas e vaza', () => {
  it('as fichas ficam entre o assento e a carta da vaza', () => {
    expect(TRICK_RADIUS_RATIO).toBeLessThan(BET_RADIUS_RATIO);
    expect(BET_RADIUS_RATIO).toBeLessThan(1);

    for (const seat of opponentSeats(4)) {
      const dAssento = Math.hypot(seat.x - 50, seat.y - 50);
      const dFicha = Math.hypot(seat.betX - 50, seat.betY - 50);
      const dVaza = Math.hypot(seat.trickX - 50, seat.trickY - 50);
      expect(dVaza).toBeLessThan(dFicha);
      expect(dFicha).toBeLessThan(dAssento);
    }
  });

  it('a carta da vaza fica longe o bastante do centro para não cobrir o monte', () => {
    for (const seat of opponentSeats(5)) {
      expect(Math.hypot(seat.trickX - 50, seat.trickY - 50)).toBeGreaterThan(10);
    }
  });
});

describe('seatMap', () => {
  it('indexa o local e os adversários na ordem de mesa', () => {
    const map = seatMap('p0', ['p1', 'p2', 'p3']);
    expect(map.size).toBe(4);
    expect(map.get('p0')!.angle).toBe(LOCAL_SEAT_ANGLE);
    expect(map.get('p1')!.angle).toBe(210);
    expect(map.get('p3')!.angle).toBe(330);
  });

  it('mesa de dois: só eu e o adversário em frente', () => {
    const map = seatMap('p0', ['p1']);
    expect(map.get('p1')!.angle).toBe(270);
  });
});

describe('seatScale', () => {
  it('encolhe o assento conforme a mesa enche', () => {
    expect(seatScale(4)).toBe(1);
    expect(seatScale(6)).toBeLessThan(seatScale(4));
    expect(seatScale(8)).toBeLessThan(seatScale(6));
    expect(seatScale(8)).toBeGreaterThan(0.5);
  });
});
