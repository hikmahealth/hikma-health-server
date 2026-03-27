


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

// ── Time Range ────────────────────────────────────────────

@tag("type")
@genType
type timeRange =
  | Fixed({startAt: string, endAt: string})
  | Rolling({windowDays: int})

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
  timeRange?: timeRange,
}

// ── Report ─────────────────────────────────────────────────

@genType
type layoutConfig = {columns: int} // Capped at 12. TODO: Update docs and put a type literals

@genType
type report = {
  id: string,
  name: string,
  description?: string,
  timeRange: timeRange,
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

/// TimeRange constructors
@genType
let fixedRange = (~startAt: string, ~endAt: string): timeRange => {
  Fixed({startAt, endAt})
}

@genType
let rollingRange = (~windowDays: int): timeRange => {
  Rolling({windowDays: windowDays})
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
  ~timeRange: option<timeRange>=?,
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
  ?timeRange,
}

/// Report creation constructor
@genType
let constructReport = (
  ~id: string,
  ~name: string,
  ~description: string,
  ~timeRange: timeRange,
  ~layout: layoutConfig,
  ~components: array<reportComponent>,
): report => {
  id,
  name,
  description,
  timeRange,
  layout,
  components,
}
