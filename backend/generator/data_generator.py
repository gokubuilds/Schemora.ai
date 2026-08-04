import random
import ast
from graphlib import TopologicalSorter, CycleError
from faker import Faker

def build_order(schema: dict) -> list:
    """
    Returns a topologically sorted list of table names, 
    so parent tables are generated before child tables.
    """
    graph = {}
    for table, meta in schema.items():
        # Exclude self-references to avoid trivial CycleErrors
        deps = {fk["ref_table"] for fk in meta["foreign_keys"] if fk["ref_table"] != table}
        graph[table] = deps
        
    while True:
        try:
            ts = TopologicalSorter(graph)
            return list(ts.static_order())
        except CycleError as e:
            # e.args[1] is a tuple representing the cycle (e.g., A -> B -> C -> A)
            cycle = e.args[1]
            if len(cycle) >= 2:
                node_with_dep = cycle[0]
                dep_to_remove = cycle[1]
                if dep_to_remove in graph.get(node_with_dep, set()):
                    graph[node_with_dep].remove(dep_to_remove)
                else:
                    # Fallback if format differs, remove an arbitrary edge in the cycle
                    for n in cycle:
                        if graph.get(n):
                            graph[n].pop()
                            break
            else:
                # Fallback, just pick a node and clear a dependency
                for n in graph:
                    if graph[n]:
                        graph[n].pop()
                        break

def safe_eval_faker(faker_instance: Faker, expr: str):
    """
    Safely evaluates a faker expression string with complete edge-case fallback protections.
    Prevents any unexpected syntax, non-existent method, or runtime call failure from breaking execution.
    """
    if not isinstance(expr, str) or not expr.strip():
        return faker_instance.word()

    try:
        tree = ast.parse(expr, mode='eval').body
    except Exception:
        # Fallback if LLM generates invalid expression syntax
        return faker_instance.word()

    def _eval(node):
        if isinstance(node, ast.Name):
            if node.id == 'faker':
                return faker_instance
            if node.id in ('true', 'True'):
                return True
            if node.id in ('false', 'False'):
                return False
            if node.id in ('null', 'None'):
                return None
            return node.id
        elif isinstance(node, ast.Attribute):
            obj = _eval(node.value)
            if not hasattr(obj, node.attr):
                # Fall back to word() if LLM hallucinates a non-existent method (e.g., branch)
                return getattr(faker_instance, "word")
            return getattr(obj, node.attr)
        elif isinstance(node, ast.Call):
            func = _eval(node.func)
            args = [_eval(a) for a in node.args]
            kwargs = {kw.arg: _eval(kw.value) for kw in node.keywords}
            try:
                if callable(func):
                    return func(*args, **kwargs)
                return faker_instance.word()
            except Exception:
                # Fallback if runtime execution of method fails
                return faker_instance.word()
        elif isinstance(node, ast.Constant):
            return node.value
        elif isinstance(node, ast.BinOp):
            left_val = _eval(node.left)
            right_val = _eval(node.right)
            try:
                if isinstance(node.op, ast.Add): return left_val + right_val
                elif isinstance(node.op, ast.Sub): return left_val - right_val
                elif isinstance(node.op, ast.Mult): return left_val * right_val
                elif isinstance(node.op, ast.Div): return left_val / right_val if right_val != 0 else 1.0
                elif isinstance(node.op, ast.Mod): return left_val % right_val if right_val != 0 else 1
                elif isinstance(node.op, ast.Pow): return left_val ** right_val
                elif isinstance(node.op, ast.FloorDiv): return left_val // right_val if right_val != 0 else 1
            except Exception:
                return left_val
            return left_val
        elif isinstance(node, ast.UnaryOp):
            val = _eval(node.operand)
            if isinstance(node.op, ast.USub): return -val
            elif isinstance(node.op, ast.UAdd): return +val
            return val
        elif isinstance(node, ast.Tuple):
            return tuple(_eval(el) for el in node.elts)
        elif isinstance(node, ast.List):
            return [_eval(el) for el in node.elts]
        elif isinstance(node, ast.Dict):
            return {_eval(k): _eval(v) for k, v in zip(node.keys, node.values)}
        else:
            return faker_instance.word()

    try:
        return _eval(tree)
    except Exception:
        return faker_instance.word()

def generate_data(schema: dict, column_map: dict, topo_order: list, tables_config: dict = None) -> dict:
    """
    Generates mock data for all tables in the correct order,
    resolving foreign keys to actual generated values.

    tables_config: optional dict mapping table name -> {"rows": N}.
    Any table not listed defaults to 20 rows.
    """
    faker = Faker()
    if tables_config is None:
        tables_config = {}
    generated = {}  # table_name -> list of row dicts

    # Initialize all tables in generated so self-references can append incrementally
    for table in topo_order:
        generated[table] = []

    for table in topo_order:
        num_rows = tables_config.get(table, {}).get("rows", 20)
        for _ in range(num_rows):
            row = {}
            for col, faker_expr in column_map.get(table, {}).items():
                if faker_expr.startswith("FK:"):
                    # Resolve FK
                    _, ref = faker_expr.split("FK:")
                    ref_table, ref_col = ref.split(".")
                    
                    if ref_table not in generated or not generated[ref_table]:
                        # Fallback if parent table data isn't available (e.g. cycles or bad schema)
                        row[col] = None
                    else:
                        # Pick a random already-generated row from the referenced table
                        parent_row = random.choice(generated[ref_table])
                        row[col] = parent_row[ref_col]
                else:
                    # Generate value using safe evaluator
                    row[col] = safe_eval_faker(faker, faker_expr)
                    
            generated[table].append(row)

    # Second pass to patch cyclic FKs that were resolved to None
    for table in topo_order:
        for row in generated[table]:
            for col, faker_expr in column_map.get(table, {}).items():
                if faker_expr.startswith("FK:") and row[col] is None:
                    _, ref = faker_expr.split("FK:")
                    ref_table, ref_col = ref.split(".")
                    if ref_table in generated and generated[ref_table]:
                        parent_row = random.choice(generated[ref_table])
                        row[col] = parent_row[ref_col]

    return generated
