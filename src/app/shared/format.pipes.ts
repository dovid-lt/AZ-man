import { Pipe, PipeTransform } from '@angular/core';
import { dayLabel, duration, hebrewDate, hm, money, shortDate } from '../core/time';

@Pipe({ name: 'duration' })
export class DurationPipe implements PipeTransform {
  transform(ms: number, seconds = false): string {
    return duration(ms, seconds);
  }
}

@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(n: number): string {
    return money(n);
  }
}

@Pipe({ name: 'hm' })
export class HmPipe implements PipeTransform {
  transform(t: number | null | undefined): string {
    return t == null ? '—' : hm(t);
  }
}

@Pipe({ name: 'dayLabel' })
export class DayLabelPipe implements PipeTransform {
  transform(t: number): string {
    return dayLabel(t);
  }
}

@Pipe({ name: 'hebrewDate' })
export class HebrewDatePipe implements PipeTransform {
  transform(t: number): string {
    return hebrewDate(t);
  }
}

@Pipe({ name: 'shortDate' })
export class ShortDatePipe implements PipeTransform {
  transform(t: number): string {
    return shortDate(t);
  }
}

export const FORMAT_PIPES = [
  DurationPipe,
  MoneyPipe,
  HmPipe,
  DayLabelPipe,
  HebrewDatePipe,
  ShortDatePipe,
] as const;
