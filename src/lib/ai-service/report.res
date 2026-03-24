


// ── Display Types ──────────────────────────────────────────

@tag("type") @unboxed
type format = Number | Currency | Percent | Date

@tag("type") @unboxed
type sortDir = Asc | Desc

@tag("type") @unboxed
type orientation = Vertical | Horizontal

@genType
type tableColumn = {
  key: string,
  label: string,
  format?: format,
  sortable?: bool,
}

@genType
type tableConfig = {columns: array<tableColumn>}

@genType
type barChartConfig = {
  xAxis: string,
  yAxis: string,
  orientation?: orientation,
  stacked?: bool,
  sortBy?: string,
  sortDir?: sortDir,
}

@genType
type lineChartConfig = {
  xAxis: string,
  yAxis: string,
  seriesField?: string,
}

@genType
type pieChartConfig = {
  labelField: string,
  valueField: string,
}

type statCardFormat = Number | Currency | Percent

@genType
type statCardConfig = {
  valueField: string,
  label: string,
  format?: statCardFormat,
  comparisonField?: string,
}

@genType
type componentDisplay =
  | Table(tableConfig)
  | BarChart(barChartConfig)
  | LineChart(lineChartConfig)
  | PieChart(pieChartConfig)
  | StatCard(statCardConfig)

// ── Layout ─────────────────────────────────────────────────

@genType
type gridPosition = {
  x: int,
  y: int,
  w: int,
  h: int,
}

// ── Report Component ───────────────────────────────────────

@genType
type reportComponent = {
  id: string,
  reportId: string,
  title: string,
  description?: string,
  prqlSource: string,
  compiledSql: string,
  compiledAt: string,
  compilerVersion: string, // using calver TODO: add distint type
  position: gridPosition,
  display: componentDisplay,
}

// ── Report ─────────────────────────────────────────────────

@genType
type layoutConfig = {columns: int} // Capped at 12. TODO: Update docs and put a type literals

@genType
type report = {
  id: string,
  name: string,
  description?: string,
  startAt: string,
  endAt: string,
  layout: layoutConfig,
  components: array<reportComponent>,
}



/// LayoutConfig constructor
@genType
let constructLayoutConfig = (
  ~columns: int,
): layoutConfig => {
  columns,
}

/// ReportComponent constructor
@genType
let constructReportComponent = (
  ~id: string,
  ~reportId: string,
  ~title: string,
  ~description: string,
  ~prqlSource: string,
  ~compiledSql: string,
  ~compiledAt: string,
  ~compilerVersion: string,
  ~position: gridPosition,
  ~display: componentDisplay,
): reportComponent => {
  id,
  reportId,
  title,
  description,
  prqlSource,
  compiledSql,
  compiledAt,
  compilerVersion,
  position,
  display,
}

/// Report creation constructor
@genType
let constructReport = (
  ~id: string,
  ~name: string,
  ~description: string,
  ~startAt: string,
  ~endAt: string,
  ~layout: layoutConfig,
  ~components: array<reportComponent>,
): report => {
  id,
  name,
  description,
  startAt,
  endAt,
  layout,
  components,
}
