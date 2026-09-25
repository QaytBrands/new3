import { DEFAULT_TIMEZONE, listTimeZones } from "@/lib/time";

export function TimeZoneSelect({ name = "timezone", defaultValue = DEFAULT_TIMEZONE }: { name?: string; defaultValue?: string }) {
  return (
    <select className="input" name={name} defaultValue={defaultValue}>
      {listTimeZones().map((tz) => (
        <option key={tz} value={tz}>{tz}</option>
      ))}
    </select>
  );
}
