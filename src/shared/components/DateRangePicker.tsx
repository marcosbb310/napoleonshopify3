'use client';

import * as React from 'react';
import { CalendarIcon, X } from 'lucide-react';
import { addDays, format } from 'date-fns';
import { DateRange } from 'react-day-picker';

import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/components/ui/button';
import { Calendar } from '@/shared/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';

interface DateRangePickerProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  className?: string;
}

export function DateRangePicker({
  dateRange,
  onDateRangeChange,
  className,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [clickCount, setClickCount] = React.useState(0);
  
  // Reset click count when popover opens if there's already a complete range
  React.useEffect(() => {
    if (isOpen && dateRange?.from && dateRange?.to) {
      setClickCount(2);
    } else if (isOpen && dateRange?.from && !dateRange?.to) {
      setClickCount(1);
    } else if (isOpen && !dateRange) {
      setClickCount(0);
    }
  }, [isOpen, dateRange]);
  
  const handleDateSelect = (range: DateRange | undefined) => {
    if (!range?.from) {
      onDateRangeChange(undefined);
      setClickCount(0);
      return;
    }

    if (clickCount === 0) {
      // First click - set start date only
      onDateRangeChange({ from: range.from, to: undefined });
      setClickCount(1);
    } else if (clickCount === 1) {
      // Second click - complete the range
      // The calendar gives us the range with both from and to when we click the second date
      if (range.to) {
        // Ensure from is always before to
        const from = range.from.getTime() <= range.to.getTime() ? range.from : range.to;
        const to = range.from.getTime() <= range.to.getTime() ? range.to : range.from;
        onDateRangeChange({ from, to });
        setClickCount(2);
      }
    } else if (clickCount === 2) {
      // Third click - start a completely new range
      onDateRangeChange({ from: range.from, to: undefined });
      setClickCount(1);
    }
  };

  const handleClear = () => {
    onDateRangeChange(undefined);
    setClickCount(0);
  };

  const presetRanges = {
    today: {
      label: 'Today',
      range: {
        from: new Date(),
        to: new Date(),
      },
    },
    yesterday: {
      label: 'Yesterday',
      range: {
        from: addDays(new Date(), -1),
        to: addDays(new Date(), -1),
      },
    },
    last7days: {
      label: 'Last 7 days',
      range: {
        from: addDays(new Date(), -6),
        to: new Date(),
      },
    },
    last30days: {
      label: 'Last 30 days',
      range: {
        from: addDays(new Date(), -29),
        to: new Date(),
      },
    },
    thisMonth: {
      label: 'This month',
      range: {
        from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        to: new Date(),
      },
    },
    lastMonth: {
      label: 'Last month',
      range: {
        from: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
        to: new Date(new Date().getFullYear(), new Date().getMonth(), 0),
      },
    },
    last3months: {
      label: 'Last 3 months',
      range: {
        from: addDays(new Date(), -90),
        to: new Date(),
      },
    },
    last6months: {
      label: 'Last 6 months',
      range: {
        from: addDays(new Date(), -180),
        to: new Date(),
      },
    },
  };

  const handlePresetSelect = (preset: keyof typeof presetRanges) => {
    onDateRangeChange(presetRanges[preset].range);
    setClickCount(2); // Mark as complete range
    setIsOpen(false);
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn(
              'justify-start text-left font-normal w-[280px]',
              !dateRange && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange?.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, 'LLL dd, y')} -{' '}
                  {format(dateRange.to, 'LLL dd, y')}
                </>
              ) : (
                format(dateRange.from, 'LLL dd, y')
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex flex-col">
            <div className="flex border-b px-3 py-2 items-center justify-between">
              <div className="text-sm font-medium">
                {clickCount === 0 && 'Click first date to start'}
                {clickCount === 1 && 'Click second date to complete range'}
                {clickCount === 2 && 'Range selected (click again to start new)'}
              </div>
              <div className="flex gap-1">
                {dateRange && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7"
                    onClick={handleClear}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                )}
                <Button
                  variant="default"
                  size="sm"
                  className="h-7"
                  onClick={() => setIsOpen(false)}
                  disabled={clickCount !== 2}
                >
                  Apply
                </Button>
              </div>
            </div>
            <div className="flex">
              <div className="border-r p-3 space-y-1">
                <div className="text-sm font-medium mb-2">Quick Select</div>
                {Object.entries(presetRanges).map(([key, { label }]) => (
                  <Button
                    key={key}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start font-normal text-xs"
                    onClick={() => handlePresetSelect(key as keyof typeof presetRanges)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <div className="p-3">
                <div className="[&_.rdp-day.rdp-today:not(.rdp-day_selected):not(.rdp-day_range_start):not(.rdp-day_range_end):not(.rdp-day_range_middle)]:!bg-transparent [&_.rdp-day.rdp-today:not(.rdp-day_selected):not(.rdp-day_range_start):not(.rdp-day_range_end):not(.rdp-day_range_middle)]:!text-foreground">
                  <Calendar
                    mode="range"
                    defaultMonth={dateRange?.from || new Date()}
                    selected={dateRange}
                    onSelect={handleDateSelect}
                    numberOfMonths={2}
                    disabled={(date) => date > new Date()}
                  />
                </div>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

