export interface TransformationStep {
  type: string;
  parameters: Record<string, unknown>;
  customExpression?: string;
}

export interface ColumnMapping {
  id: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  transformations: TransformationStep[];
  isLossy?: boolean;
}

export interface TableMapping {
  sourceTable: string;
  targetTable: string;
  columnMappings: ColumnMapping[];
}
