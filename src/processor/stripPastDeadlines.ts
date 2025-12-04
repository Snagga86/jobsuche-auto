export function stripPastDeadlines(items: Array<{ deadline?: string }>): Array<{ deadline?: string }> {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Grenze: heute minus 6 Monate
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  return items.filter((item) => {
    if (!item.deadline || typeof item.deadline !== "string") {
      return true;
    }

    const value = item.deadline.trim();

    // Hilfsfunktion: Datum auf 00:00 setzen
    const normalize = (d: Date): Date => {
      const copy = new Date(d);
      copy.setHours(0, 0, 0, 0);
      return copy;
    };

    // Versuch 1: Native Date-Parsing
    let parsed: Date | null = null;
    let native = new Date(value);
    if (!isNaN(native.getTime())) {
      parsed = normalize(native);
    } else {
      // Versuch 2: DD.MM.YYYY / DD-MM-YYYY / DD/MM/YYYY
      let match = value.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})$/);
      if (match) {
        let [, dStr, mStr, yStr] = match;
        let day = parseInt(dStr, 10);
        let month = parseInt(mStr, 10);
        let year = parseInt(yStr.length === 2 ? "20" + yStr : yStr, 10);
        const tmp = new Date(year, month - 1, day);
        if (!isNaN(tmp.getTime())) {
          parsed = normalize(tmp);
        }
      } else {
        // Versuch 3: Textform mit Jahreszahl
        if (/\d{4}/.test(value)) {
          const tmp = new Date(value);
          if (!isNaN(tmp.getTime())) {
            parsed = normalize(tmp);
          }
        }
      }
    }

    // Kein erkennbares Datum → behalten
    if (!parsed) {
      return true;
    }

    // Entfernen, wenn älter als 6 Monate
    return parsed >= sixMonthsAgo;
  });
}
