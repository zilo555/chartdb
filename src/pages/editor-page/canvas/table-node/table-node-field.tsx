import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    Handle,
    Position,
    useConnection,
    useUpdateNodeInternals,
} from '@xyflow/react';
import { Button } from '@/components/button/button';
import {
    Check,
    KeyRound,
    MessageCircleMore,
    SquareDot,
    SquareMinus,
    SquarePlus,
    Trash2,
} from 'lucide-react';
import { generateDBFieldSuffix, type DBField } from '@/lib/domain/db-field';
import { useChartDB } from '@/hooks/use-chartdb';
import { cn } from '@/lib/utils';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/tooltip/tooltip';
import { useClickAway, useKeyPressEvent } from 'react-use';
import { Input } from '@/components/input/input';
import { useDiff } from '@/context/diff-context/use-diff';
import { useLocalConfig } from '@/hooks/use-local-config';

export const LEFT_HANDLE_ID_PREFIX = 'left_rel_';
export const RIGHT_HANDLE_ID_PREFIX = 'right_rel_';
export const TARGET_ID_PREFIX = 'target_rel_';

export interface TableNodeFieldProps {
    tableNodeId: string;
    field: DBField;
    focused: boolean;
    highlighted: boolean;
    visible: boolean;
    isConnectable: boolean;
}

const arePropsEqual = (
    prevProps: TableNodeFieldProps,
    nextProps: TableNodeFieldProps
) => {
    return (
        prevProps.field.id === nextProps.field.id &&
        prevProps.field.name === nextProps.field.name &&
        prevProps.field.primaryKey === nextProps.field.primaryKey &&
        prevProps.field.nullable === nextProps.field.nullable &&
        prevProps.field.comments === nextProps.field.comments &&
        prevProps.field.unique === nextProps.field.unique &&
        prevProps.field.type.id === nextProps.field.type.id &&
        prevProps.field.type.name === nextProps.field.type.name &&
        prevProps.field.characterMaximumLength ===
            nextProps.field.characterMaximumLength &&
        prevProps.field.precision === nextProps.field.precision &&
        prevProps.field.scale === nextProps.field.scale &&
        prevProps.focused === nextProps.focused &&
        prevProps.highlighted === nextProps.highlighted &&
        prevProps.visible === nextProps.visible &&
        prevProps.isConnectable === nextProps.isConnectable &&
        prevProps.tableNodeId === nextProps.tableNodeId
    );
};

export const TableNodeField: React.FC<TableNodeFieldProps> = React.memo(
    ({ field, focused, tableNodeId, highlighted, visible, isConnectable }) => {
        const {
            removeField,
            relationships,
            readonly,
            updateField,
            highlightedCustomType,
        } = useChartDB();
        const [editMode, setEditMode] = useState(false);
        const [fieldName, setFieldName] = useState(field.name);
        const inputRef = React.useRef<HTMLInputElement>(null);

        const updateNodeInternals = useUpdateNodeInternals();
        const connection = useConnection();
        const isTarget = useMemo(
            () =>
                connection.inProgress &&
                connection.fromNode.id !== tableNodeId &&
                (connection.fromHandle.id?.startsWith(RIGHT_HANDLE_ID_PREFIX) ||
                    connection.fromHandle.id?.startsWith(
                        LEFT_HANDLE_ID_PREFIX
                    )),
            [
                connection.inProgress,
                connection.fromNode?.id,
                connection.fromHandle?.id,
                tableNodeId,
            ]
        );
        const numberOfEdgesToField = useMemo(() => {
            let count = 0;
            for (const rel of relationships) {
                if (
                    rel.targetTableId === tableNodeId &&
                    rel.targetFieldId === field.id
                ) {
                    count++;
                }
            }
            return count;
        }, [relationships, tableNodeId, field.id]);

        const previousNumberOfEdgesToFieldRef = useRef(numberOfEdgesToField);

        useEffect(() => {
            if (
                previousNumberOfEdgesToFieldRef.current !== numberOfEdgesToField
            ) {
                const timer = setTimeout(() => {
                    updateNodeInternals(tableNodeId);
                    previousNumberOfEdgesToFieldRef.current =
                        numberOfEdgesToField;
                }, 100);
                return () => clearTimeout(timer);
            }
        }, [tableNodeId, updateNodeInternals, numberOfEdgesToField]);

        const editFieldName = useCallback(() => {
            if (!editMode) return;
            if (fieldName.trim()) {
                updateField(tableNodeId, field.id, { name: fieldName.trim() });
            }
            setEditMode(false);
        }, [fieldName, field.id, updateField, editMode, tableNodeId]);

        const abortEdit = useCallback(() => {
            setEditMode(false);
            setFieldName(field.name);
        }, [field.name]);

        useClickAway(inputRef, editFieldName);
        useKeyPressEvent('Enter', editFieldName);
        useKeyPressEvent('Escape', abortEdit);

        const {
            checkIfFieldRemoved,
            checkIfNewField,
            getFieldNewName,
            getFieldNewType,
            checkIfFieldHasChange,
        } = useDiff();

        const [diffState, setDiffState] = useState<{
            isDiffFieldRemoved: boolean;
            isDiffNewField: boolean;
            fieldDiffChangedName: string | null;
            fieldDiffChangedType: DBField['type'] | null;
            isDiffFieldChanged: boolean;
        }>({
            isDiffFieldRemoved: false,
            isDiffNewField: false,
            fieldDiffChangedName: null,
            fieldDiffChangedType: null,
            isDiffFieldChanged: false,
        });

        useEffect(() => {
            // Calculate diff state asynchronously
            const timer = requestAnimationFrame(() => {
                setDiffState({
                    isDiffFieldRemoved: checkIfFieldRemoved({
                        fieldId: field.id,
                    }),
                    isDiffNewField: checkIfNewField({ fieldId: field.id }),
                    fieldDiffChangedName: getFieldNewName({
                        fieldId: field.id,
                    }),
                    fieldDiffChangedType: getFieldNewType({
                        fieldId: field.id,
                    }),
                    isDiffFieldChanged: checkIfFieldHasChange({
                        fieldId: field.id,
                        tableId: tableNodeId,
                    }),
                });
            });
            return () => cancelAnimationFrame(timer);
        }, [
            checkIfFieldRemoved,
            checkIfNewField,
            getFieldNewName,
            getFieldNewType,
            checkIfFieldHasChange,
            field.id,
            tableNodeId,
        ]);

        const {
            isDiffFieldRemoved,
            isDiffNewField,
            fieldDiffChangedName,
            fieldDiffChangedType,
            isDiffFieldChanged,
        } = diffState;

        const enterEditMode = useCallback((e: React.MouseEvent) => {
            e.stopPropagation();
            setEditMode(true);
        }, []);

        const isCustomTypeHighlighted = useMemo(() => {
            if (!highlightedCustomType) return false;
            return field.type.name === highlightedCustomType.name;
        }, [highlightedCustomType, field.type.name]);
        const { showFieldAttributes } = useLocalConfig();

        return (
            <div
                className={cn(
                    'group relative flex h-8 items-center justify-between gap-1 border-t px-3 text-sm last:rounded-b-[6px] hover:bg-slate-100 dark:hover:bg-slate-800',
                    'transition-all duration-200 ease-in-out',
                    {
                        'bg-pink-100 dark:bg-pink-900':
                            highlighted && !isCustomTypeHighlighted,
                        'bg-yellow-100 dark:bg-yellow-900':
                            isCustomTypeHighlighted,
                        'max-h-8 opacity-100': visible,
                        'z-0 max-h-0 overflow-hidden opacity-0': !visible,
                        'bg-sky-200 dark:bg-sky-800 hover:bg-sky-100 dark:hover:bg-sky-900 border-sky-300 dark:border-sky-700':
                            isDiffFieldChanged &&
                            !isDiffFieldRemoved &&
                            !isDiffNewField,
                        'bg-red-200 dark:bg-red-800 hover:bg-red-100 dark:hover:bg-red-900 border-red-300 dark:border-red-700':
                            isDiffFieldRemoved,
                        'bg-green-200 dark:bg-green-800 hover:bg-green-100 dark:hover:bg-green-900 border-green-300 dark:border-green-700':
                            isDiffNewField,
                    }
                )}
            >
                {isConnectable ? (
                    <>
                        <Handle
                            id={`${RIGHT_HANDLE_ID_PREFIX}${field.id}`}
                            className={`!h-4 !w-4 !border-2 !bg-pink-600 ${!focused || readonly ? '!invisible' : ''}`}
                            position={Position.Right}
                            type="source"
                        />
                        <Handle
                            id={`${LEFT_HANDLE_ID_PREFIX}${field.id}`}
                            className={`!h-4 !w-4 !border-2 !bg-pink-600 ${!focused || readonly ? '!invisible' : ''}`}
                            position={Position.Left}
                            type="source"
                        />
                    </>
                ) : null}
                {(!connection.inProgress || isTarget) && isConnectable && (
                    <>
                        {Array.from(
                            { length: numberOfEdgesToField },
                            (_, index) => index
                        ).map((index) => (
                            <Handle
                                id={`${TARGET_ID_PREFIX}${index}_${field.id}`}
                                key={`${TARGET_ID_PREFIX}${index}_${field.id}`}
                                className={`!invisible`}
                                position={Position.Left}
                                type="target"
                            />
                        ))}
                        <Handle
                            id={`${TARGET_ID_PREFIX}${numberOfEdgesToField}_${field.id}`}
                            className={
                                isTarget
                                    ? '!absolute !left-0 !top-0 !h-full !w-full !transform-none !rounded-none !border-none !opacity-0'
                                    : `!invisible`
                            }
                            position={Position.Left}
                            type="target"
                        />
                    </>
                )}
                <div
                    className={cn(
                        'flex items-center gap-1 min-w-0 flex-1 text-left',
                        {
                            'font-semibold': field.primaryKey || field.unique,
                            'w-full': editMode,
                        }
                    )}
                >
                    {isDiffFieldRemoved ? (
                        <SquareMinus className="size-3.5 text-red-800 dark:text-red-200" />
                    ) : isDiffNewField ? (
                        <SquarePlus className="size-3.5 text-green-800 dark:text-green-200" />
                    ) : isDiffFieldChanged ? (
                        <SquareDot className="size-3.5 shrink-0 text-sky-800 dark:text-sky-200" />
                    ) : null}
                    {editMode && !readonly ? (
                        <>
                            <Input
                                ref={inputRef}
                                onBlur={editFieldName}
                                placeholder={field.name}
                                autoFocus
                                type="text"
                                value={fieldName}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => setFieldName(e.target.value)}
                                className="h-5 w-full border-[0.5px] border-blue-400 bg-slate-100 focus-visible:ring-0 dark:bg-slate-900"
                            />
                            <Button
                                variant="ghost"
                                className="size-6 p-0 text-slate-500 hover:bg-primary-foreground hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                onClick={editFieldName}
                            >
                                <Check className="size-4" />
                            </Button>
                        </>
                    ) : (
                        <span
                            className={cn('truncate min-w-0', {
                                'text-red-800 font-normal dark:text-red-200':
                                    isDiffFieldRemoved,
                                'text-green-800 font-normal dark:text-green-200':
                                    isDiffNewField,
                                'text-sky-800 font-normal dark:text-sky-200':
                                    isDiffFieldChanged &&
                                    !isDiffFieldRemoved &&
                                    !isDiffNewField,
                            })}
                            onDoubleClick={enterEditMode}
                        >
                            {fieldDiffChangedName ? (
                                <>
                                    {field.name}{' '}
                                    <span className="font-medium">→</span>{' '}
                                    {fieldDiffChangedName}
                                </>
                            ) : (
                                field.name
                            )}
                        </span>
                    )}
                    {field.comments && !editMode ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="shrink-0 cursor-pointer text-muted-foreground">
                                    <MessageCircleMore size={14} />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>{field.comments}</TooltipContent>
                        </Tooltip>
                    ) : null}
                </div>
                {editMode ? null : (
                    <div className="ml-2 flex shrink-0 items-center justify-end gap-1.5">
                        {field.primaryKey ? (
                            <div
                                className={cn(
                                    'text-muted-foreground',
                                    !readonly ? 'group-hover:hidden' : '',
                                    isDiffFieldRemoved
                                        ? 'text-red-800 dark:text-red-200'
                                        : '',
                                    isDiffNewField
                                        ? 'text-green-800 dark:text-green-200'
                                        : '',
                                    isDiffFieldChanged &&
                                        !isDiffFieldRemoved &&
                                        !isDiffNewField
                                        ? 'text-sky-800 dark:text-sky-200'
                                        : ''
                                )}
                            >
                                <KeyRound size={14} />
                            </div>
                        ) : null}

                        <div
                            className={cn(
                                'content-center text-right text-xs text-muted-foreground overflow-hidden max-w-[8rem]',
                                field.primaryKey ? 'min-w-0' : 'min-w-[3rem]',
                                !readonly ? 'group-hover:hidden' : '',
                                isDiffFieldRemoved
                                    ? 'text-red-800 dark:text-red-200'
                                    : '',
                                isDiffNewField
                                    ? 'text-green-800 dark:text-green-200'
                                    : '',
                                isDiffFieldChanged &&
                                    !isDiffFieldRemoved &&
                                    !isDiffNewField
                                    ? 'text-sky-800 dark:text-sky-200'
                                    : ''
                            )}
                        >
                            <span className="block truncate">
                                {fieldDiffChangedType ? (
                                    <>
                                        <span className="line-through">
                                            {field.type.name.split(' ')[0]}
                                        </span>{' '}
                                        {
                                            fieldDiffChangedType.name.split(
                                                ' '
                                            )[0]
                                        }
                                    </>
                                ) : (
                                    `${field.type.name.split(' ')[0]}${showFieldAttributes ? generateDBFieldSuffix(field) : ''}`
                                )}
                                {field.nullable ? '?' : ''}
                            </span>
                        </div>
                        {readonly ? null : (
                            <div className="hidden flex-row group-hover:flex">
                                <Button
                                    variant="ghost"
                                    className="size-6 p-0 hover:bg-primary-foreground"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeField(tableNodeId, field.id);
                                    }}
                                >
                                    <Trash2 className="size-3.5 text-red-700" />
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    },
    arePropsEqual
);

TableNodeField.displayName = 'TableNodeField';
