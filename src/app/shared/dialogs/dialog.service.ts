import { ComponentType } from '@angular/cdk/portal';
import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { DataStore } from '../../core/data.store';
import { Id, ProjectFilter, TimeRange } from '../../core/models';
import { AddShiftDialog } from './add-shift.dialog';
import { BrokenListData, BrokenListDialog } from './broken-list.dialog';
import { ConfirmData, ConfirmDialog } from './confirm.dialog';
import { DayDetailDialog } from './day-detail.dialog';
import { FixBrokenDialog } from './fix-broken.dialog';
import { MidnightChoice, MidnightData, MidnightDialog } from './midnight.dialog';
import { PeriodDetailDialog } from './period-detail.dialog';
import { RateChangeData, RateChangeDialog, RateChangeResult } from './rate-change.dialog';
import { RateHistoryDialog } from './rate-history.dialog';
import { PunchAtData, PunchAtDialog, PunchAtResult } from './punch-at.dialog';
import { ShiftEditDialog } from './shift-edit.dialog';
import { TimePromptData, TimePromptDialog } from './time-prompt.dialog';

/** נקודת כניסה אחת לכל החלונות ביישום. */
@Injectable({ providedIn: 'root' })
export class DialogService {
  private readonly dialog = inject(MatDialog);
  private readonly store = inject(DataStore);

  private open<D, R>(
    cmp: ComponentType<unknown>,
    data: D,
    width = '460px',
  ): Promise<R | undefined> {
    return firstValueFrom(
      this.dialog.open<unknown, D, R>(cmp, { data, width, maxWidth: '95vw' }).afterClosed(),
    );
  }

  async confirm(data: ConfirmData): Promise<boolean> {
    return (await this.open<ConfirmData, boolean>(ConfirmDialog, data, '400px')) === true;
  }

  promptTime(data: TimePromptData): Promise<number | undefined> {
    return this.open<TimePromptData, number>(TimePromptDialog, data, '420px');
  }

  midnight(data: MidnightData): Promise<MidnightChoice | undefined> {
    return this.open<MidnightData, MidnightChoice>(MidnightDialog, data, '520px');
  }

  punchAt(data: PunchAtData = {}): Promise<PunchAtResult | undefined> {
    return this.open<PunchAtData, PunchAtResult>(PunchAtDialog, data, '440px');
  }

  /** עריכת משמרת. רשומה שבורה נפתחת בחלון התיקון. */
  editShift(shiftId: Id): Promise<unknown> {
    const cmp = this.isBroken(shiftId) ? FixBrokenDialog : ShiftEditDialog;
    return this.open(cmp, { shiftId }, '520px');
  }

  fixBroken(shiftId: Id): Promise<unknown> {
    return this.open(FixBrokenDialog, { shiftId }, '520px');
  }

  brokenList(filter: ProjectFilter, range?: TimeRange, title?: string): Promise<unknown> {
    return this.open<BrokenListData, unknown>(BrokenListDialog, { filter, range, title }, '620px');
  }

  addShift(): Promise<unknown> {
    return this.open(AddShiftDialog, {}, '480px');
  }

  dayDetail(day: number, filter: ProjectFilter): Promise<unknown> {
    return this.open(DayDetailDialog, { day, filter }, '760px');
  }

  periodDetail(title: string, range: TimeRange, filter: ProjectFilter): Promise<unknown> {
    return this.open(PeriodDetailDialog, { title, range, filter }, '720px');
  }

  rateChange(data: RateChangeData): Promise<RateChangeResult | undefined> {
    return this.open<RateChangeData, RateChangeResult>(RateChangeDialog, data, '480px');
  }

  rateHistory(projectId: Id): Promise<unknown> {
    return this.open(RateHistoryDialog, { projectId }, '520px');
  }

  private isBroken(id: Id): boolean {
    return !!this.store.shift(id)?.broken;
  }
}
