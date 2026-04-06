import streamlit as st
import pandas as pd
from io import BytesIO
from datetime import datetime, timedelta
import random
import networkx as nx
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np
import warnings
import os
import tempfile
import json
import base64
warnings.filterwarnings('ignore')
plt.rcParams['figure.figsize'] = [16, 12]
plt.rcParams['font.size'] = 10
st.set_page_config(layout="wide")
st.markdown("""
<style>
div.stButton > button {
    padding: 0.1rem 0.3rem;
    min-width: auto;
    font-size: 12px;
}
</style>
""", unsafe_allow_html=True)

def get_img_as_base64(file):
    with open(file, "rb") as f:
        data = f.read()
    return base64.b64encode(data).decode()

sanya_img = get_img_as_base64("sanya-bodibilder.png")

# Списки персонала и систем
personnel = [
    "Сюндюков А.В.", "Иванова Е.П.", "Петров С.М.", "Сидорова О.И.", "Козлов Д.А.",
    "Николаев Г.Р.", "Макарова В.Л.", "Орлов Н.С.", "Васнецова Т.К.", "Жуков П.Ф.",
    "Алексеева М.Д.", "Тихонов И.Г.", "Павлова А.Н.", "Фролов В.Я.", "Савельев К.О.",
    "Морозова Л.Б.", "Белов Р.Т.", "Комарова Ю.Э.", "Громов Е.Ц.", "Ильина Н.Ч.",
    "Данилов Б.Х.", "Семёнова З.Щ.", "Блинов М.Ю.", "Ларина А.Ж.", "Гордеев И.У.",
    "Инженер РНГМ L2", "Инженер ГДМ L2", "Инженер обустройства L2"
]
systems_list = [
    "Сервис Микросервис Б6К Расчет ХВ скважин", "Б6К Расчет Кпрод скважин", "Б6К Расчет Pпл скважин",
    "Б6К Расчет запасов скважин", "Спектр spektr-addperforations", "Спектр Расчёт ГРП",
    "Спектр Сервис оптимизации тех параметров", "Спектр Сервис ОПЗ", "Спектр Расчёт проницаемости",
    "Спектр Расчёт восстановления давления", "Спектр Расчёт ПВЛГ", "Спектр Расчёт ВБД",
    "Спектр Расчет ЗБС", "eXoil Адаптация модели пласта на основе метода граничных элементов",
    "eXoil Модель вытеснения на основе линий тока", "eXoil Оптимизатор ППД", "eXoil Проектные скважины",
    "eXoil АТСР", "eXoil Расчет запусконого дебита по скважине",
    "eXoil Адаптация модели пласта на основе метода граничных элементов",
    "eXoil Модель пласта на основе метода граничных элементов",
    "eXoil Модель вытеснения на основе линий тока", "eXoil Оптимизатор ППД", "eXoil Проектные скважины",
    "ГибрИМА Расчёт IPR-кривых", "ГибрИМА Расчёт узлового анализа",
    "ГибрИМА Оптимизатор режимов работы скважин с учётом влияния устьевого давления",
    "ЦД велл Расчет PVT свойств", "ЦД велл Расчет продуктивности",
    "ЦД велл Расчет кривых распределения давления и температуры по стволу (Моделирование VLP)",
    "ЦД велл Расчет узлового анализа", "ЦД велл Расчет анализа чувствительности"
]
# Инициализация состояния
if 'stages' not in st.session_state:
    st.session_state.stages = []
    st.session_state.tasks = {}
if 'loaded' not in st.session_state:
    st.session_state.loaded = False
if 'iterations' not in st.session_state:
    st.session_state.iterations = []
if 'editing_task' not in st.session_state:
    st.session_state.editing_task = None
if 'editing_stage' not in st.session_state:
    st.session_state.editing_stage = None
if 'view_mode' not in st.session_state:
    st.session_state.view_mode = "Подробный вид"
if 'expanded_states' not in st.session_state:
    st.session_state.expanded_states = {}
if 'current_board' not in st.session_state:
    st.session_state.current_board = None
# Функции для экспорта и импорта
def generate_excel():
    data = []
    base_excel_date = datetime(1899, 12, 30).date() # Добавляем .date() один раз
    for stage in st.session_state.stages:
        tasks_in_stage = st.session_state.tasks.get(stage, []) # Защита от KeyError (рекомендую)
        for task in tasks_in_stage:
            for entry in task['entries']:
                row = {
                    "Этап Название": stage,
                    "Карточка ID": task['id'],
                    "Карточка Название": task['name'],
                    "Исполнитель": task['executor'],
                    "Согласующий": task['approver'],
                    "Срок сдачи": (task['deadline'] - base_excel_date).days, # Теперь date - date
                    "Статус": task['status'],
                    "Дата создания": task['date'],
                    "Используемые системы": entry['system'],
                    "Входные данные": entry['input'],
                    "Выходные данные": entry['output']
                }
                data.append(row)
    df = pd.DataFrame(data)
    output = BytesIO()
    df.to_excel(output, index=False, engine='openpyxl')
    output.seek(0)
    return output.getvalue()
def generate_template():
    columns = ["Этап Название", "Карточка ID", "Карточка Название", "Исполнитель", "Согласующий", "Срок сдачи",
               "Статус", "Дата создания", "Используемые системы", "Входные данные", "Выходные данные"]
    df = pd.DataFrame(columns=columns)
    output = BytesIO()
    df.to_excel(output, index=False, engine='openpyxl')
    output.seek(0)
    return output.getvalue()
def load_board_from_excel(df):
    if df.empty:
        st.error("Файл пустой.")
        return False
    required = ["Этап Название", "Карточка ID", "Карточка Название", "Исполнитель", "Согласующий", "Срок сдачи",
                "Статус", "Дата создания", "Используемые системы", "Входные данные", "Выходные данные"]
    if not all(col in df.columns for col in required):
        st.error("Файл не соответствует структуре доски.")
        return False
    new_stages = []
    new_tasks = {}
    seen_stages = set()
    seen_tasks = {} # stage: set of card_ids
    unique_personnel = set()
    for _, row in df.iterrows():
        stage = row['Этап Название']
        if pd.isna(stage) or not stage:
            continue # Skip invalid stages
        if stage not in seen_stages:
            seen_stages.add(stage)
            new_stages.append(stage)
            new_tasks[stage] = []
            seen_tasks[stage] = set()
        card_id = row['Карточка ID']
        if pd.isna(card_id) or not card_id:
            continue # Skip invalid card_ids
        if card_id not in seen_tasks[stage]:
            seen_tasks[stage].add(card_id)
            deadline_serial = row.get('Срок сдачи')
            try:
                deadline_serial = int(deadline_serial)
                deadline = datetime(1899, 12, 30).date() + timedelta(days=deadline_serial)
            except:
                deadline = datetime.now().date()
            executor = row['Исполнитель']
            approver = row['Согласующий']
            unique_personnel.add(executor)
            unique_personnel.add(approver)
            task = {
                'id': card_id,
                'name': row['Карточка Название'],
                'executor': executor,
                'approver': approver,
                'deadline': deadline,
                'status': row['Статус'],
                'date': row['Дата создания'],
                'entries': []
            }
            new_tasks[stage].append(task)
        # Find the task
        task = next(t for t in new_tasks[stage] if t['id'] == card_id)
        system = row['Используемые системы']
        if pd.isna(system):
            system = ''
        else:
            system = str(system).strip()
        input_d = row['Входные данные']
        if pd.isna(input_d):
            input_d = ''
        else:
            input_d = str(input_d).strip()
        output_d = row['Выходные данные']
        if pd.isna(output_d):
            output_d = ''
        else:
            output_d = str(output_d).strip()
        entry = {
            'system': system,
            'input': input_d,
            'output': output_d
        }
        if entry['system']:
            task['entries'].append(entry)
    st.session_state.stages = new_stages
    st.session_state.tasks = new_tasks
    st.session_state.loaded = True
    # Add new personnel
    for p in unique_personnel:
        if p and p not in personnel:
            personnel.append(p)
    return True
# Модифицированная функция generate_oilflow_html
def generate_oilflow_html():
    if len(st.session_state.stages) == 0:
        return "<html><body><h1 style='text-align:center; margin-top:200px;'>Нет данных — добавьте этапы и задачи</h1></body></html>".encode(
            'utf-8')
    nodes = []
    edges = []
    node_id_counter = 0
    x_base = 100
    stage_node_ids = [] # Для хранения ID узлов этапов
    for stage_idx, stage_name in enumerate(st.session_state.stages):
        short_stage_label = stage_name[:35] + "..." if len(stage_name) > 35 else stage_name
        stage_node_id = node_id_counter
        stage_node_ids.append(stage_node_id)
        nodes.append({
            'id': stage_node_id,
            'label': short_stage_label,
            'title': stage_name, # Полное название при наведении
            'x': x_base + stage_idx * 450,
            'y': 120,
            'color': {'background': '#3b82f6', 'border': '#1e40af'},
            'font': {'color': '#ffffff', 'size': 16},
            'shape': 'box',
            'widthConstraint': {'minimum': 220},
            'heightConstraint': {'minimum': 60},
            'margin': 14,
            'shadow': {'enabled': True, 'color': 'rgba(0,0,0,0.2)', 'size': 8, 'x': 3, 'y': 3}
        })
        node_id_counter += 1
        y = 280
        task_node_ids = [] # Для хранения ID узлов задач в текущем этапе
        for task_idx, task in enumerate(st.session_state.tasks.get(stage_name, [])):
            task_node_id = node_id_counter
            task_node_ids.append(task_node_id)
            status_color = {
                'в работе': '#f59e0b',
                'завершен': '#10b981',
                'ошибка': '#ef4444',
                'пауза': '#'
                         '080'
            }.get(task['status'], '#d1d5db')
            short_label = f"{task['id']} — {task['name'][:35]}..." if len(
                task['name']) > 35 else f"{task['id']} — {task['name']}"
            full_label = f"{task['id']} — {task['name']}"
            nodes.append({
                'id': task_node_id,
                'label': short_label,
                'title': full_label, # Полное название при наведении
                'x': x_base + stage_idx * 450 + 60,
                'y': y + task_idx * 140,
                'color': {'background': '#ffffff', 'border': status_color},
                'font': {'color': '#1f2937', 'size': 14},
                'shape': 'box',
                'widthConstraint': {'minimum': 260},
                'heightConstraint': {'minimum': 50},
                'margin': 12,
                'shadow': {'enabled': True, 'color': 'rgba(0,0,0,0.15)', 'size': 6, 'x': 2, 'y': 2}
            })
            node_id_counter += 1
        # Добавляем стрелки внутри этапа
        if task_node_ids:
            # Стрелка от этапа к первой карточке
            edges.append({
                'from': stage_node_id,
                'to': task_node_ids[0],
                'arrows': 'to',
                'smooth': {'type': 'cubicBezier', 'roundness': 0.6},
                'color': {'color': '#64748b', 'highlight': '#3b82f6'},
                'width': 1.5
            })
            # Последовательные стрелки между карточками
            for k in range(len(task_node_ids) - 1):
                edges.append({
                    'from': task_node_ids[k],
                    'to': task_node_ids[k + 1],
                    'arrows': 'to',
                    'smooth': {'type': 'cubicBezier', 'roundness': 0.6},
                    'color': {'color': '#64748b', 'highlight': '#3b82f6'},
                    'width': 1.5
                })
    # Добавляем стрелки между этапами слева-направо
    for idx in range(len(stage_node_ids) - 1):
        edges.append({
            'from': stage_node_ids[idx],
            'to': stage_node_ids[idx + 1],
            'arrows': 'to',
            'smooth': {'type': 'cubicBezier', 'roundness': 0.6},
            'color': {'color': '#64748b', 'highlight': '#3b82f6'},
            'width': 1.5
        })
    nodes_json = json.dumps(nodes)
    edges_json = json.dumps(edges)
    html = f"""
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8">
        <title>OilFlow — Интерактивный граф задач</title>
        <script src="https://unpkg.com/vis-network@9.1.9/standalone/umd/vis-network.min.js"></script>
        <style>
            body {{ margin:0; padding:0; overflow:hidden; background:#f1f5f9; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }}
            #mynetwork {{
                width:100vw;
                height:100vh;
                background-image:
                    radial-gradient(circle at 10px 10px, #9ca3af 1px, transparent 1px),
                    radial-gradient(circle at 30px 30px, #9ca3af 1px, transparent 1px);
                background-size: 20px 20px;
            }}
            #instructions {{
                position: absolute;
                top: 10px;
                left: 10px;
                background: rgba(255,255,255,0.95);
                padding: 10px 14px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                z-index: 999;
                font-size: 12px;
                line-height: 1.4;
                max-width: 280px;
                border: 1px solid #e5e7eb;
                pointer-events: none;
            }}
            #instructions strong {{ color: #1d4ed8; }}
        </style>
    </head>
    <body>
        <div id="mynetwork"></div>
        <div id="instructions">
            <strong>Управление:</strong><br>
            • Перетаскивание узлов — свободно<br>
            • Создание связи — кликните на узел-источник, затем на узел-цель<br>
            • Отмена выбора — клик по пустому месту<br>
            • Удаление — выделите → Delete<br>
            • Зум/пан — колесо / правая кнопка + drag<br>
            • Добавить узел — правая кнопка на пустом месте → выбрать тип и название
        </div>
        <script>
            var nodes = new vis.DataSet({nodes_json});
            var edges = new vis.DataSet({edges_json});
            var container = document.getElementById('mynetwork');
            var data = {{ nodes: nodes, edges: edges }};
            var options = {{
                nodes: {{
                    shape: 'box',
                    font: {{ multi: true, size: 14, face: 'Arial' }},
                    margin: 14,
                    borderWidth: 2,
                    shadow: true
                }},
                edges: {{
                    arrows: 'to',
                    smooth: {{ type: 'cubicBezier', roundness: 0.6 }},
                    color: {{ inherit: 'to', highlight: '#3b82f6' }},
                    width: 1.5
                }},
                physics: {{ enabled: false }},
                layout: {{ hierarchical: {{ enabled: false }} }},
                interaction: {{
                    dragNodes: true,
                    dragView: false,
                    zoomView: true,
                    multiselect: true,
                    hover: true,
                    navigationButtons: true,
                    selectable: true
                }}
            }};
            var network = new vis.Network(container, data, options);
            var selectedSource = null;
            var originalBorder = null;
            network.on("click", function(params) {{
                if (params.nodes.length > 0) {{
                    var clickedNode = params.nodes[0];
                    if (selectedSource === null) {{
                        selectedSource = clickedNode;
                        originalBorder = nodes.get(clickedNode).color.border;
                        nodes.update([{{id: clickedNode, color: {{border: '#60a5fa'}} }}]);
                        network.setOptions({{interaction: {{dragNodes: false}}}});
                        network.redraw();
                    }} else if (selectedSource !== clickedNode) {{
                        var newEdgeId = 'e_custom_' + Date.now();
                        edges.add({{
                            id: newEdgeId,
                            from: selectedSource,
                            to: clickedNode,
                            arrows: 'to',
                            smooth: {{ type: 'cubicBezier', roundness: 0.6 }},
                            color: {{ color: '#64748b', highlight: '#3b82f6' }},
                            width: 1.5
                        }});
                        nodes.update([{{id: selectedSource, color: {{border: originalBorder}} }}]);
                        network.setOptions({{interaction: {{dragNodes: true}}}});
                        network.redraw();
                        selectedSource = null;
                    }}
                }} else {{
                    if (selectedSource !== null) {{
                        nodes.update([{{id: selectedSource, color: {{border: originalBorder}} }}]);
                        network.setOptions({{interaction: {{dragNodes: true}}}});
                        network.redraw();
                        selectedSource = null;
                    }}
                }}
            }});
            // Добавление нового узла по правому клику
            container.addEventListener('contextmenu', function (e) {{
                e.preventDefault();
                var pos = network.getViewPosition({{ x: e.clientX, y: e.clientY }});
                var type = prompt("Тип узла: 'этап' или 'задача'?", "задача");
                if (!type) return;
                var name = prompt("Название нового узла:", type === 'этап' ? 'Новый этап' : 'Новая задача');
                if (!name) return;
                var newId = nodes.length;
                var newNode = {{
                    id: newId,
                    label: name,
                    x: pos.x,
                    y: pos.y,
                    color: {{ background: type === 'этап' ? '#3b82f6' : '#ffffff', border: type === 'этап' ? '#1e40af' : '#cbd5e1' }},
                    font: {{ color: type === 'этап' ? '#ffffff' : '#1f2937', size: 14 }},
                    shape: 'box',
                    widthConstraint: {{ minimum: type === 'этап' ? 220 : 260 }},
                    heightConstraint: {{ minimum: 60 }},
                    margin: 14,
                    shadow: true
                }};
                nodes.add(newNode);
            }});
            // Удаление по Delete
            document.addEventListener('keydown', function(e) {{
                if (e.key === 'Delete' || e.key === 'Backspace') {{
                    var selectedNodes = network.getSelectedNodes();
                    var selectedEdges = network.getSelectedEdges();
                    if (selectedNodes.length > 0 || selectedEdges.length > 0) {{
                        if (confirm("Удалить выбранные элементы?")) {{
                            nodes.remove(selectedNodes);
                            edges.remove(selectedEdges);
                        }}
                    }}
                }}
            }});
        </script>
    </body>
    </html>
    """
    return html.encode('utf-8')
# ===================== 1. ЗАГРУЗКА И ПОДГОТОВКА ДАННЫХ =====================
def load_and_prepare_data(file_path):
    try:
        if not os.path.exists(file_path):
            return None
        df = pd.read_excel(file_path)
        columns_for_graph = [
            'Этап Название',
            'Карточка Название',
            'Исполнитель',
            'Используемые системы',
            'Входные данные',
            'Выходные данные'
        ]
        available_columns = df.columns.tolist()
        missing_columns = [col for col in columns_for_graph if col not in available_columns]
        if missing_columns:
            return None
        df_graph = df[columns_for_graph].copy()
        for col in df_graph.columns:
            df_graph[col] = df_graph[col].astype(str).str.strip()
            df_graph[col] = df_graph[col].replace('nan', '')
        return df_graph
    except Exception as e:
        return None
# ===================== 2. ПОСТРОЕНИЕ ГРАФА =====================
def build_graph(df):
    G = nx.Graph()
    node_colors = {
        'Этап Название': '#FF6B6B',
        'Карточка Название': '#4ECDC4',
        'Используемые системы': '#06D6A0',
    }
    node_types = {}
    for idx, row in df.iterrows():
        stage = row['Этап Название']
        card = row['Карточка Название']
        system = row['Используемые системы']
        if stage:
            node_id = f"Этап Название: {stage}"
            if node_id not in G:
                G.add_node(node_id)
                node_types[node_id] = 'Этап Название'
        if card:
            node_id = f"Карточка Название: {card}"
            if node_id not in G:
                G.add_node(node_id)
                node_types[node_id] = 'Карточка Название'
        if system:
            node_id = f"Используемые системы: {system}"
            if node_id not in G:
                G.add_node(node_id)
                node_types[node_id] = 'Используемые системы'
        if stage and card:
            G.add_edge(f"Этап Название: {stage}", f"Карточка Название: {card}")
        if card and system:
            G.add_edge(f"Карточка Название: {card}", f"Используемые системы: {system}")
    return G, node_types, node_colors
# ===================== 3. ВИЗУАЛИЗАЦИЯ ГРАФА (ИНТЕРАКТИВНАЯ С VIS.JS) =====================
def visualize_interactive_graph(G, node_types, node_colors):
    if G.number_of_nodes() == 0:
        return None
    nodes_js = []
    edges_js = []
    node_id_map = {}
    id_counter = 0
    for node in G.nodes():
        node_type = node_types.get(node, 'Unknown')
        color = node_colors.get(node_type, '#808080')
        degree = G.degree(node)
        size = 10 + degree * 2
        label = node.split(": ", 1)[1] if ": " in node else node
        if len(label) > 25:
            label = label[:22] + "..."
        node_id_map[node] = id_counter
        nodes_js.append({
            'id': id_counter,
            'label': label,
            'color': color,
            'size': size,
            'title': node
        })
        id_counter += 1
    for edge in G.edges():
        edges_js.append({
            'from': node_id_map[edge[0]],
            'to': node_id_map[edge[1]],
            'color': 'gray',
            'width': 1
        })
    html = f"""
    <html>
    <head>
        <script type="text/javascript" src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
    </head>
    <body>
        <div id="mynetwork" style="width:100%; height:800px;"></div>
        <script type="text/javascript">
            var nodes = new vis.DataSet({str(nodes_js)});
            var edges = new vis.DataSet({str(edges_js)});
            var container = document.getElementById('mynetwork');
            var data = {{nodes: nodes, edges: edges}};
            var options = {{
                nodes: {{
                    shape: 'dot',
                    font: {{size: 14, multi: true}}
                }},
                edges: {{
                    arrows: {{to: {{enabled: true}}}}
                }},
                physics: {{
                    enabled: true,
                    solver: 'forceAtlas2Based',
                    forceAtlas2Based: {{
                        gravitationalConstant: -50,
                        centralGravity: 0.01,
                        springLength: 100,
                        springConstant: 0.08
                    }}
                }},
                interaction: {{
                    dragNodes: true,
                    zoomView: true,
                    dragView: true
                }}
            }};
            var network = new vis.Network(container, data, options);
        </script>
    </body>
    </html>
    """
    return html
# ===================== 3. ВИЗУАЛИЗАЦИЯ ГРАФА (СТАТИЧНАЯ, ДЛЯ АНАЛИТИКИ) =====================
def visualize_graph(G, node_types, node_colors):
    if G.number_of_nodes() == 0:
        return None, None
    node_color_list = []
    node_sizes = []
    for node in G.nodes():
        node_type = node_types.get(node, 'Unknown')
        node_color_list.append(node_colors.get(node_type, '#808080'))
        degree = G.degree(node)
        node_sizes.append(100 + degree * 20)
    if G.number_of_nodes() < 50:
        pos = nx.spring_layout(G, k=2, iterations=100, seed=42)
    elif G.number_of_nodes() < 200:
        pos = nx.spring_layout(G, k=1.5, iterations=80, seed=42)
    else:
        pos = nx.spring_layout(G, k=1, iterations=60, seed=42)
    fig, ax = plt.subplots(figsize=(20, 16))
    nx.draw_networkx_edges(G, pos, alpha=0.2, edge_color='gray', width=0.8, ax=ax)
    nx.draw_networkx_nodes(G, pos, node_color=node_color_list, node_size=node_sizes, alpha=0.85, edgecolors='white',
                           linewidths=1.5, ax=ax)
    labels = {}
    for node in G.nodes():
        node_value = node.split(": ", 1)[1] if ": " in node else node
        if len(node_value) > 25:
            labels[node] = node_value[:22] + "..."
        else:
            labels[node] = node_value
    nx.draw_networkx_labels(G, pos, labels, font_size=9, font_weight='bold', font_family='sans-serif', ax=ax)
    legend_patches = []
    for node_type, color in node_colors.items():
        count = sum(1 for n_type in node_types.values() if n_type == node_type)
        patch = mpatches.Patch(color=color, label=f"{node_type} ({count} узлов)", alpha=0.8)
        legend_patches.append(patch)
    ax.legend(handles=legend_patches, loc='upper left', bbox_to_anchor=(1.05, 1), fontsize=11, framealpha=0.9,
              title="Типы узлов", title_fontsize=12)
    plt.title(
        f'Граф связей между параметрами проектов\nВсего узлов: {G.number_of_nodes()}, Связей: {G.number_of_edges()}',
        fontsize=16, fontweight='bold', pad=25)
    info_text = f"Плотность графа: {nx.density(G):.4f}\nСредняя степень узла: {sum(dict(G.degree()).values()) / G.number_of_nodes():.2f}"
    plt.figtext(0.02, 0.02, info_text, fontsize=10,
                bbox=dict(boxstyle="round,pad=0.5", facecolor="lightgray", alpha=0.7))
    plt.axis('off')
    plt.tight_layout(rect=[0, 0.03, 0.85, 0.97])
    return fig, ax
# ===================== 4. АНАЛИЗ ГРАФА =====================
def analyze_graph(G, node_types):
    if G.number_of_nodes() == 0:
        return None, None
    # Здесь мы возвращаем только для save_results, без отображения
    components = list(nx.connected_components(G))
    degree_dict = dict(G.degree())
    return degree_dict, components
def generate_analysis_html(G, node_types):
    if G.number_of_nodes() == 0:
        return "<div><h2>Анализ графа</h2><p>Нет данных</p></div>"
    html = "<div style='padding:20px;'><h2>Анализ графа</h2>"
    # Основная статистика
    html += "<div style='border:1px solid #ccc; padding:10px; margin-bottom:10px;'><h3>📊 ОСНОВНАЯ СТАТИСТИКА</h3>"
    html += f"<p> • Узлов всего: {G.number_of_nodes()}</p>"
    html += f"<p> • Связей всего: {G.number_of_edges()}</p>"
    html += f"<p> • Плотность графа: {nx.density(G):.4f}</p></div>"
    # Узлов по типам
    html += "<div style='border:1px solid #ccc; padding:10px; margin-bottom:10px;'><h3>🎨 УЗЛОВ ПО ТИПАМ</h3>"
    type_counts = {}
    type_degrees = {}
    for node, node_type in node_types.items():
        type_counts[node_type] = type_counts.get(node_type, 0) + 1
        degree = G.degree(node)
        if node_type not in type_degrees:
            type_degrees[node_type] = []
        type_degrees[node_type].append(degree)
    for node_type, count in type_counts.items():
        avg_degree = np.mean(type_degrees[node_type]) if node_type in type_degrees else 0
        percentage = count / G.number_of_nodes() * 100
        html += f"<p> • {node_type}:</p>"
        html += f"<p> Количество: {count} ({percentage:.1f}%)</p>"
        html += f"<p> Средняя связей: {avg_degree:.2f}</p>"
    html += "</div>"
    # Топ-10 наиболее связанных узлов
    html += "<div style='border:1px solid #ccc; padding:10px; margin-bottom:10px;'><h3>🔗 ТОП-10 НАИБОЛЕЕ СВЯЗАННЫХ УЗЛОВ</h3>"
    degree_dict = dict(G.degree())
    sorted_nodes = sorted(degree_dict.items(), key=lambda x: x[1], reverse=True)[:10]
    for i, (node, degree) in enumerate(sorted_nodes, 1):
        node_type = node_types.get(node, 'Unknown')
        node_value = node.split(": ", 1)[1] if ": " in node else node
        html += f"<p> {i:2d}. {node_value[:35]}</p>"
        html += f"<p> Тип: {node_type}, Связей: {degree}</p>"
    html += "</div>"
    # Ключевые связующие узлы
    html += "<div style='border:1px solid #ccc; padding:10px; margin-bottom:10px;'><h3>⭐ КЛЮЧЕВЫЕ СВЯЗУЮЩИЕ УЗЛЫ (ХАБЫ)</h3>"
    hub_candidates = []
    for node in G.nodes():
        neighbors = list(G.neighbors(node))
        if len(neighbors) >= 3:
            neighbor_types = set(node_types.get(neighbor, 'Unknown') for neighbor in neighbors)
            if len(neighbor_types) >= 2:
                hub_candidates.append((node, len(neighbors), len(neighbor_types)))
    hub_candidates.sort(key=lambda x: x[1], reverse=True)
    for i, (node, num_connections, num_types) in enumerate(hub_candidates[:5], 1):
        node_value = node.split(": ", 1)[1] if ": " in node else node
        node_type = node_types.get(node, 'Unknown')
        html += f"<p> {i}. {node_value[:35]}</p>"
        html += f"<p> Тип: {node_type}, Связей: {num_connections}, Типов соседей: {num_types}</p>"
    html += "</div>"
    # Компоненты связности
    html += "<div style='border:1px solid #ccc; padding:10px; margin-bottom:10px;'><h3>🔗 КОМПОНЕНТЫ СВЯЗНОСТИ</h3>"
    components = list(nx.connected_components(G))
    html += f"<p> • Всего компонент связности: {len(components)}</p>"
    if len(components) > 1:
        sorted_components = sorted(components, key=len, reverse=True)
        for i, comp in enumerate(sorted_components[:5], 1):
            html += f"<p> {i}. {len(comp)} узлов ({len(comp) / G.number_of_nodes() * 100:.1f}%)</p>"
    if components:
        largest_component = max(components, key=len)
        if len(largest_component) > 1:
            subgraph = G.subgraph(largest_component)
            if nx.is_connected(subgraph):
                try:
                    diameter = nx.diameter(subgraph)
                    html += f"<p> • Диаметр самой большой компоненты: {diameter}</p>"
                except:
                    html += f"<p> • Диаметр: невозможно вычислить</p>"
    html += "</div>"
    html += "</div>"
    return html
def create_additional_visualizations(G, node_types, node_colors):
    if G.number_of_nodes() == 0:
        return None
    fig, axes = plt.subplots(2, 2, figsize=(16, 14))
    degrees = [G.degree(n) for n in G.nodes()]
    axes[0, 0].hist(degrees, bins=20, color='skyblue', edgecolor='black', alpha=0.7)
    axes[0, 0].set_title('Распределение количества связей у узлов', fontsize=12, fontweight='bold')
    axes[0, 0].set_xlabel('Количество связей')
    axes[0, 0].set_ylabel('Количество узлов')
    axes[0, 0].grid(True, alpha=0.3)
    axes[0, 0].axvline(x=np.mean(degrees), color='red', linestyle='--', label=f'Среднее: {np.mean(degrees):.2f}')
    axes[0, 0].legend()
    type_counts = {}
    for node, node_type in node_types.items():
        type_counts[node_type] = type_counts.get(node_type, 0) + 1
    types = list(type_counts.keys())
    counts = list(type_counts.values())
    colors = [node_colors.get(t, '#808080') for t in types]
    bars = axes[0, 1].bar(types, counts, color=colors, alpha=0.8, edgecolor='black')
    axes[0, 1].set_title('Количество узлов по типам', fontsize=12, fontweight='bold')
    axes[0, 1].set_ylabel('Количество узлов')
    axes[0, 1].tick_params(axis='x', rotation=45)
    for bar, count in zip(bars, counts):
        height = bar.get_height()
        axes[0, 1].text(bar.get_x() + bar.get_width() / 2., height + 0.1,
                        f'{count}', ha='center', va='bottom', fontsize=10)
    avg_connections = {}
    for node_type in set(node_types.values()):
        nodes_of_type = [n for n in G.nodes() if node_types.get(n) == node_type]
        if nodes_of_type:
            total_connections = sum(G.degree(n) for n in nodes_of_type)
            avg_connections[node_type] = total_connections / len(nodes_of_type)
    types_avg = list(avg_connections.keys())
    avgs = list(avg_connections.values())
    colors_avg = [node_colors.get(t, '#808080') for t in types_avg]
    bars2 = axes[1, 0].bar(types_avg, avgs, color=colors_avg, alpha=0.8, edgecolor='black')
    axes[1, 0].set_title('Среднее количество связей по типам узлов', fontsize=12, fontweight='bold')
    axes[1, 0].set_ylabel('Среднее число связей')
    axes[1, 0].tick_params(axis='x', rotation=45)
    overall_avg = sum(avgs) / len(avgs) if avgs else 0
    axes[1, 0].axhline(y=overall_avg, color='red', linestyle='--', alpha=0.7, label=f'Общее среднее: {overall_avg:.2f}')
    axes[1, 0].legend()
    for bar, avg in zip(bars2, avgs):
        height = bar.get_height()
        axes[1, 0].text(bar.get_x() + bar.get_width() / 2., height + 0.05,
                        f'{avg:.2f}', ha='center', va='bottom', fontsize=9)
    degree_dict = dict(G.degree())
    top_nodes = sorted(degree_dict.items(), key=lambda x: x[1], reverse=True)[:8]
    top_node_names = []
    for node, _ in top_nodes:
        node_value = node.split(": ", 1)[1] if ": " in node else node
        if len(node_value) > 20:
            top_node_names.append(node_value[:18] + "...")
        else:
            top_node_names.append(node_value)
    top_node_degrees = [n[1] for n in top_nodes]
    top_node_colors = [node_colors.get(node_types.get(n[0], 'Unknown'), '#808080') for n in top_nodes]
    y_pos = range(len(top_node_names))
    bars3 = axes[1, 1].barh(y_pos, top_node_degrees, color=top_node_colors, alpha=0.8, edgecolor='black')
    axes[1, 1].set_yticks(y_pos)
    axes[1, 1].set_yticklabels(top_node_names)
    axes[1, 1].invert_yaxis()
    axes[1, 1].set_title('Наиболее связанные узлы', fontsize=12, fontweight='bold')
    axes[1, 1].set_xlabel('Количество связей')
    for bar, degree in zip(bars3, top_node_degrees):
        width = bar.get_width()
        axes[1, 1].text(width + 0.1, bar.get_y() + bar.get_height() / 2.,
                        f'{degree}', ha='left', va='center', fontsize=10)
    plt.tight_layout(rect=[0, 0, 1, 0.96])
    plt.suptitle('Аналитическая панель графа связей', fontsize=16, fontweight='bold')
    return fig
def save_results(G, node_types, df_graph, degree_dict, components):
    nodes_data = []
    for node in G.nodes():
        node_type = node_types.get(node, 'Unknown')
        degree = G.degree(node)
        centrality = degree_dict.get(node, 0) if degree_dict else 0
        neighbors = list(G.neighbors(node))
        neighbor_types = {}
        for neighbor in neighbors:
            n_type = node_types.get(neighbor, 'Unknown')
            neighbor_types[n_type] = neighbor_types.get(n_type, 0) + 1
        component_id = -1
        for i, comp in enumerate(components):
            if node in comp:
                component_id = i
                break
        if ": " in node:
            node_prefix, node_value = node.split(": ", 1)
        else:
            node_prefix, node_value = node, node
        nodes_data.append({
            'ID_Узла': node,
            'Тип_Узла': node_type,
            'Значение_Узла': node_value,
            'Количество_Связей': degree,
            'Центральность': centrality,
            'ID_Компоненты': component_id,
            'Размер_Компоненты': len(components[component_id]) if component_id != -1 else 0,
            'Соседи_Всего': len(neighbors),
            'Соседи_по_Типам': str(neighbor_types)
        })
    nodes_df = pd.DataFrame(nodes_data)
    edges_data = []
    for edge in G.edges(data=True):
        node1_type = node_types.get(edge[0], 'Unknown')
        node2_type = node_types.get(edge[1], 'Unknown')
        node1_value = edge[0].split(": ", 1)[1] if ": " in edge[0] else edge[0]
        node2_value = edge[1].split(": ", 1)[1] if ": " in edge[1] else edge[1]
        edges_data.append({
            'Узел_1': edge[0],
            'Тип_Узла_1': node1_type,
            'Значение_Узла_1': node1_value,
            'Узел_2': edge[1],
            'Тип_Узла_2': node2_type,
            'Значение_Узла_2': node2_value,
            'Тип_Связи': f"{node1_type} ↔ {node2_type}"
        })
    edges_df = pd.DataFrame(edges_data)
    type_stats = []
    for node_type in set(node_types.values()):
        nodes_of_type = [n for n in G.nodes() if node_types.get(n) == node_type]
        count = len(nodes_of_type)
        if count > 0:
            avg_degree = sum(G.degree(n) for n in nodes_of_type) / count
            type_stats.append({
                'Тип_Узла': node_type,
                'Количество': count,
                'Процент': count / G.number_of_nodes() * 100,
                'Средняя_Связей': avg_degree
            })
    stats_df = pd.DataFrame(type_stats)
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        nodes_df.to_excel(writer, sheet_name='Узлы_графа', index=False)
        edges_df.to_excel(writer, sheet_name='Связи_графа', index=False)
        stats_df.to_excel(writer, sheet_name='Статистика_по_Типам', index=False)
        df_graph.to_excel(writer, sheet_name='Исходные_данные', index=False)
        top_nodes_df = nodes_df.nlargest(20, 'Количество_Связей')
        top_nodes_df.to_excel(writer, sheet_name='Топ_Узлов', index=False)
    output.seek(0)
    return output.getvalue()
# Функция для генерации полного HTML для онтологии
def generate_ontology_html(df_graph, G, node_types, node_colors, fig_analysis):
    interactive_html = visualize_interactive_graph(G, node_types, node_colors)
    # Сохраняем fig_analysis в BytesIO как PNG
    buf = BytesIO()
    fig_analysis.savefig(buf, format="png", bbox_inches='tight')
    buf.seek(0)
    analysis_img_base64 = base64.b64encode(buf.read()).decode('utf-8')
    # Генерация HTML для анализа
    analysis_html = generate_analysis_html(G, node_types)
    full_html = f"""
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8">
        <title>Онтология</title>
        <style>
            body {{ font-family: Arial, sans-serif; margin: 20px; }}
            .container {{ display: flex; flex-wrap: wrap; justify-content: space-between; }}
            .section {{ width: 48%; margin-bottom: 20px; }}
            @media (max-width: 1200px) {{ .section {{ width: 100%; }} }}
        </style>
    </head>
    <body>
        <h1>Интерактивный граф</h1>
        {interactive_html}
        <div class="container">
            <div class="section">
                <h1>Аналитическая панель</h1>
                <img src="data:image/png;base64,{analysis_img_base64}" alt="Аналитика" style="width:100%;">
            </div>
            <div class="section">
                {analysis_html}
            </div>
        </div>
    </body>
    </html>
    """
    return full_html.encode('utf-8')
# Функция для загрузки доски из локального файла
def load_local_board(file_path):
    try:
        df = pd.read_excel(file_path)
        if load_board_from_excel(df):
            st.success("Доска загружена!")
            st.rerun()
    except Exception as e:
        st.error(f"Ошибка загрузки: {e}")
# Верхняя панель
st.markdown(" ", unsafe_allow_html=True)
col_left, col_right = st.columns([7, 3])
with col_left:
    st.markdown(" ", unsafe_allow_html=True)
    st.button("← Назад")
    st.markdown("<h1>Планировщик производственных задач</h1>", unsafe_allow_html=True)
    board_options = {
        "hantos": "ООО \"Газпромнефть-Хантос\" \\ Зимнее",
        "nng1": "ООО \"Газпромнефть-ННГ\" \\ Новогоднее",
        "nng2": "ООО \"Газпромнефть-Мегион\" \\ Аганское"
    }
    col_btn1, col_btn2, col_btn3 = st.columns(3)
    with col_btn1:
        button_type = "primary" if st.session_state.current_board == "hantos" else "secondary"
        if st.button(board_options["hantos"], type=button_type):
            st.session_state.current_board = "hantos"
            load_local_board("hantos.xlsx")  # Замените на реальный путь к файлу
    with col_btn2:
        button_type = "primary" if st.session_state.current_board == "nng1" else "secondary"
        if st.button(board_options["nng1"], type=button_type):
            st.session_state.current_board = "nng1"
            load_local_board("nng.xlsx")  # Замените на реальный путь к файлу
    with col_btn3:
        button_type = "primary" if st.session_state.current_board == "nng2" else "secondary"
        if st.button(board_options["nng2"], type=button_type):
            st.session_state.current_board = "nng2"
            load_local_board("mgn.xlsx")  # Замените на реальный путь к файлу
    if st.session_state.current_board:
        st.markdown(f"<h3>{board_options[st.session_state.current_board]}</h3>", unsafe_allow_html=True)
    st.markdown(" ", unsafe_allow_html=True)
with col_right:
    board_file = st.file_uploader("Загрузить структуру доски", type=["xlsx"], key="board_upload")
    if board_file is not None:
        if st.button("Применить структуру доски"):
            try:
                df = pd.read_excel(board_file)
                if load_board_from_excel(df):
                    st.success("Структура доски обновлена!")
                    st.rerun()
            except Exception as e:
                st.error(f"Ошибка: {e}")
    st.download_button("Выгрузить структуру доски", data=generate_excel(), file_name="tasks_board.xlsx")
    st.download_button("Скачать шаблон таблицы", data=generate_template(), file_name="template.xlsx")
    st.markdown(' ', unsafe_allow_html=True)
    st.markdown(f"Сюндюков АВ\\ Ведущий эксперт <img src='data:image/png;base64,{sanya_img}' style='width:20px; height:20px; border-radius:50%; vertical-align: middle;'>", unsafe_allow_html=True)
    st.markdown(" ", unsafe_allow_html=True)
# Контролы
c1, c2, c3, c4, c5, c6, c7 = st.columns([1.5, 1, 2, 2, 1, 1, 2])
with c1:
    st.text_input("Поиск")
with c2:
    st.button("Фильтры")
with c3:
    view_mode = st.radio("Вид", ["Упрощенный вид", "Подробный вид"],
                         index=0 if st.session_state.view_mode == "Упрощенный вид" else 1, horizontal=True)
    if view_mode != st.session_state.view_mode:
        st.session_state.view_mode = view_mode
        expand = view_mode == "Подробный вид"
        for key in st.session_state.expanded_states:
            st.session_state.expanded_states[key] = expand
        st.rerun()
with c4:
    if st.button("Скачать OilFlow граф (интерактивный HTML)"):
        html_data = generate_oilflow_html()
        if html_data:
            st.download_button(
                label="⬇ Скачать oilflow_graph.html",
                data=html_data,
                file_name="oilflow_graph.html",
                mime="text/html",
                key="download_oilflow"
            )
        else:
            st.warning("Нет данных для графа — добавьте этапы и задачи.")
with c5:
    if st.button("Онтология"):
        data = []
        for stage in st.session_state.stages:
            for task in st.session_state.tasks[stage]:
                for entry in task['entries']:
                    row = {
                        "Этап Название": stage,
                        "Карточка Название": task['name'],
                        "Исполнитель": task['executor'],
                        "Используемые системы": entry['system'],
                        "Входные данные": entry['input'],
                        "Выходные данные": entry['output']
                    }
                    data.append(row)
        df = pd.DataFrame(data)
        with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as tmp:
            df.to_excel(tmp.name, index=False)
            tmp_path = tmp.name
        df_graph = load_and_prepare_data(tmp_path)
        if df_graph is not None:
            G, node_types, node_colors = build_graph(df_graph)
            # Генерация HTML для онтологии
            fig_analysis = create_additional_visualizations(G, node_types, node_colors)
            degree_dict, components = analyze_graph(G, node_types) # Получаем данные, но не отображаем
            ontology_html = generate_ontology_html(df_graph, G, node_types, node_colors, fig_analysis)
            st.download_button("Скачать онтологию HTML", ontology_html, "ontology.html", "text/html")
            excel_data = save_results(G, node_types, df_graph, degree_dict, components)
            st.download_button("Скачать анализ в Excel", data=excel_data, file_name="граф_анализ.xlsx")
        else:
            st.error("Нет данных для построения графа.")
        os.unlink(tmp_path)
with c6:
    if st.button("+ Добавить этап"):
        st.session_state.stages.insert(0, "Новый этап")
        st.session_state.tasks["Новый этап"] = []
        st.session_state.editing_stage = 0
        st.rerun()
with c7:
    if st.button("Рассчитать"):
        data = []
        for stage in st.session_state.stages:
            for task in st.session_state.tasks[stage]:
                for entry in task['entries']:
                    row = {
                        "Этап Название": stage,
                        "Карточка Название": task['name'],
                        "Исполнитель": task['executor'],
                        "Используемые системы": entry['system'],
                        "Входные данные": entry['input'],
                        "Выходные данные": entry['output']
                    }
                    data.append(row)
        df = pd.DataFrame(data)
        with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as tmp:
            df.to_excel(tmp.name, index=False)
            tmp_path = tmp.name
        df_graph = load_and_prepare_data(tmp_path)
        if df_graph is not None:
            G, node_types, node_colors = build_graph(df_graph)
            col1, col2 = st.columns(2)
            with col1:
                html_graph = visualize_interactive_graph(G, node_types, node_colors)
                if html_graph:
                    st.components.v1.html(html_graph, height=800)
            with col2:
                fig_analysis = create_additional_visualizations(G, node_types, node_colors)
                if fig_analysis:
                    st.pyplot(fig_analysis)
            analyze_graph(G, node_types)
        else:
            st.error("Нет данных для расчёта.")
        os.unlink(tmp_path)
# Основная доска
st.markdown(" ", unsafe_allow_html=True)
# Генерация итераций только если загружено из файла
if st.session_state.loaded:
    num_stages = len(st.session_state.stages)
    stage_width = 340
    padding_per_side = 50
    st.session_state.iterations = []
    start1 = 0
    end1 = min(3, num_stages)
    if end1 - start1 >= 2:
        span1 = end1 - start1
        width1 = span1 * stage_width - 2 * padding_per_side
        left1 = start1 * stage_width + (span1 * stage_width - width1) / 2
        st.session_state.iterations.append({
            'width': max(width1, 260),
            'left': left1,
            'color': '#4ECDC4',
            'label': '2 итерация',
            'top': 20
        })
    center_start = max(0, (num_stages // 2) - 2)
    center_end = min(num_stages, center_start + 4)
    if center_end - center_start < 3:
        center_end = min(num_stages, center_start + 3)
    if center_end - center_start >= 2:
        span2 = center_end - center_start
        width2 = span2 * stage_width - 2 * padding_per_side
        left2 = center_start * stage_width + (span2 * stage_width - width2) / 2
        left2 += random.choice([-30, 30])
        st.session_state.iterations.append({
            'width': max(width2, 300),
            'left': left2,
            'color': '#FFD166',
            'label': '3 итерация',
            'top': 80
        })
    start3 = max(0, num_stages - 3)
    end3 = num_stages
    if end3 - start3 >= 2:
        span3 = end3 - start3
        width3 = span3 * stage_width - 2 * padding_per_side
        left3 = start3 * stage_width + (span3 * stage_width - width3) / 2
        st.session_state.iterations.append({
            'width': max(width3, 260),
            'left': left3,
            'color': '#FF6B6B',
            'label': '2 итерация',
            'top': 140
        })
# Колонки этапов
if len(st.session_state.stages) == 0:
    st.info("Доска пуста. Загрузите структуру доски.")
else:
    cols = st.columns(len(st.session_state.stages))
    for i, stage in enumerate(st.session_state.stages):
        with cols[i]:
            st.markdown(f" ", unsafe_allow_html=True)
            header_left, header_right = st.columns([4, 1])
            with header_left:
                if st.session_state.editing_stage == i:
                    new_name = st.text_input("Название этапа", value=stage, key=f"stage_name_{i}")
                    if st.button("Сохранить"):
                        old_name = stage
                        st.session_state.stages[i] = new_name
                        st.session_state.tasks[new_name] = st.session_state.tasks.pop(old_name)
                        st.session_state.editing_stage = None
                        st.rerun()
                else:
                    st.markdown(f"<h3 style='margin:0'>{stage}</h3>", unsafe_allow_html=True)
            with header_right:
                st.markdown(" ", unsafe_allow_html=True)
                if st.button("✏️", key=f"edit_stage_{i}"):
                    st.session_state.editing_stage = i
                    st.rerun()
                if st.button("🗑️", key=f"delete_stage_{i}"):
                    del st.session_state.tasks[stage]
                    st.session_state.stages.pop(i)
                    st.session_state.editing_stage = None
                    st.rerun()
                if i > 0:
                    if st.button("←", key=f"stage_left_{i}"):
                        st.session_state.stages[i - 1], st.session_state.stages[i] = st.session_state.stages[i], \
                                                                                     st.session_state.stages[i - 1]
                        st.rerun()
                if i < len(st.session_state.stages) - 1:
                    if st.button("→", key=f"stage_right_{i}"):
                        st.session_state.stages[i], st.session_state.stages[i + 1] = st.session_state.stages[i + 1], \
                                                                                     st.session_state.stages[i]
                        st.rerun()
            st.markdown(" ", unsafe_allow_html=True)
            for j, task in enumerate(st.session_state.tasks[stage]):
                key = f"expander_{i}_{j}"
                if key not in st.session_state.expanded_states:
                    st.session_state.expanded_states[key] = st.session_state.view_mode == "Подробный вид"
                expanded = st.session_state.expanded_states[key]
                with st.expander(f"{task['id']} — {task['name']}", expanded=expanded):
                    st.markdown(f" ", unsafe_allow_html=True)
                    if st.session_state.editing_task == (i, j):
                        new_name = st.text_input("Название задачи", value=task['name'])
                        # For executor
                        executor_options = personnel + ["Добавить нового..."]
                        try:
                            exec_index = executor_options.index(task['executor'])
                        except ValueError:
                            exec_index = len(executor_options) - 1
                        selected_executor = st.selectbox("Исполнитель", executor_options, index=exec_index)
                        if selected_executor == "Добавить нового...":
                            custom_executor = st.text_input("Введите ФИО нового исполнителя", value=task['executor'] if exec_index == len(executor_options) - 1 else "")
                            new_executor = custom_executor
                        else:
                            new_executor = selected_executor
                        # For approver
                        approver_options = personnel + ["Добавить нового..."]
                        try:
                            appr_index = approver_options.index(task['approver'])
                        except ValueError:
                            appr_index = len(approver_options) - 1
                        selected_approver = st.selectbox("Согласующий", approver_options, index=appr_index)
                        if selected_approver == "Добавить нового...":
                            custom_approver = st.text_input("Введите ФИО нового согласующего", value=task['approver'] if appr_index == len(approver_options) - 1 else "")
                            new_approver = custom_approver
                        else:
                            new_approver = selected_approver
                        new_deadline = st.date_input("Срок сдачи", value=task['deadline'])
                        new_status = st.selectbox("Статус", ["в работе", "завершен", "ошибка", "пауза"],
                                                  index=["в работе", "завершен", "ошибка", "пауза"].index(task['status']) if task['status'] in ["в работе", "завершен", "ошибка", "пауза"] else 0)
                        cleaned_entries = []
                        for entry in task['entries']:
                            system = entry.get('system')
                            if system is None or pd.isna(system):
                                system = ''
                            else:
                                system = str(system).strip()
                            input_d = entry.get('input')
                            if input_d is None or pd.isna(input_d):
                                input_d = ''
                            else:
                                input_d = str(input_d).strip()
                            output_d = entry.get('output')
                            if output_d is None or pd.isna(output_d):
                                output_d = ''
                            else:
                                output_d = str(output_d).strip()
                            cleaned = {
                                'system': system,
                                'input': input_d,
                                'output': output_d
                            }
                            if cleaned['system']:
                                cleaned_entries.append(cleaned)
                        if not cleaned_entries:
                            cleaned_entries = [{'system': '', 'input': '', 'output': ''}]
                        entries_df = pd.DataFrame(cleaned_entries)
                        edited_entries = st.data_editor(
                            entries_df,
                            num_rows="dynamic",
                            column_config={
                                "system": st.column_config.TextColumn(
                                    "Система"
                                ),
                                "input": st.column_config.TextColumn("Входные данные"),
                                "output": st.column_config.TextColumn("Выходные данные")
                            },
                            use_container_width=True,
                            hide_index=True,
                            key=f"editor_{i}_{j}"
                        )
                        col_save, col_cancel = st.columns(2)
                        with col_save:
                            if st.button("Сохранить", key=f"save_{i}_{j}"):
                                task['name'] = new_name
                                task['executor'] = new_executor
                                if new_executor and new_executor not in personnel:
                                    personnel.append(new_executor)
                                task['approver'] = new_approver
                                if new_approver and new_approver not in personnel:
                                    personnel.append(new_approver)
                                task['deadline'] = new_deadline
                                task['status'] = new_status
                                cleaned_entries = []
                                for entry in edited_entries.to_dict(orient='records'):
                                    system = entry.get('system')
                                    if system is None or pd.isna(system):
                                        system = ''
                                    else:
                                        system = str(system).strip()
                                    if not system:
                                        continue
                                    input_d = entry.get('input')
                                    if input_d is None or pd.isna(input_d):
                                        input_d = ''
                                    else:
                                        input_d = str(input_d).strip()
                                    output_d = entry.get('output')
                                    if output_d is None or pd.isna(output_d):
                                        output_d = ''
                                    else:
                                        output_d = str(output_d).strip()
                                    cleaned_entry = {
                                        'system': system,
                                        'input': input_d,
                                        'output': output_d
                                    }
                                    cleaned_entries.append(cleaned_entry)
                                task['entries'] = cleaned_entries
                                st.session_state.editing_task = None
                                st.rerun()
                        with col_cancel:
                            if st.button("Отмена", key=f"cancel_{i}_{j}"):
                                st.session_state.editing_task = None
                                st.rerun()
                    else:
                        status_map = {'завершен': 'green', 'ошибка': 'red', 'в работе': 'blue', 'пауза': 'gray'}
                        st.markdown(
                            f"<span style='color: {status_map.get(task['status'], 'gray')}; font-weight: bold;'>{task['status']}</span>",
                            unsafe_allow_html=True)
                        st.markdown(f"**Срок:** {task['deadline']}", unsafe_allow_html=True)
                        if task['executor'] == "Сюндюков А.В.":
                            st.markdown(f"**Исполнитель:** {task['executor']} <img src='data:image/png;base64,{sanya_img}' style='width:20px; height:20px; border-radius:50%; vertical-align: middle;'>", unsafe_allow_html=True)
                        else:
                            st.markdown(f"**Исполнитель:** {task['executor']} 🔵", unsafe_allow_html=True)
                        if task['approver'] == "Сюндюков А.В.":
                            st.markdown(f"**Согласующий:** {task['approver']} <img src='data:image/png;base64,{sanya_img}' style='width:20px; height:20px; border-radius:50%; vertical-align: middle;'>", unsafe_allow_html=True)
                        else:
                            st.markdown(f"**Согласующий:** {task['approver']} 🔵", unsafe_allow_html=True)
                        st.markdown("**Используемые системы:**", unsafe_allow_html=True)
                        unique_systems = list(dict.fromkeys(entry['system'] for entry in task['entries'] if isinstance(entry.get('system'), str) and entry['system'].strip()))
                        for sys in unique_systems:
                            st.markdown(f"- {sys}", unsafe_allow_html=True)
                        st.markdown("**Результаты расчета**", unsafe_allow_html=True)
                        col_edit, col_delete = st.columns(2)
                        with col_edit:
                            if st.button("Редактировать", key=f"edit_{i}_{j}"):
                                st.session_state.editing_task = (i, j)
                                st.rerun()
                        with col_delete:
                            if st.button("Удалить", key=f"delete_task_{i}_{j}"):
                                st.session_state.tasks[stage].pop(j)
                                st.session_state.editing_task = None
                                st.rerun()
                    st.markdown(" ", unsafe_allow_html=True)
            if st.button("+ Добавить задачу", key=f"add_{i}"):
                new_task = {
                    'id': f"M{random.randint(15000, 99999)}",
                    'name': "Новая задача",
                    'executor': personnel[0],
                    'approver': personnel[0],
                    'deadline': datetime.now().date(),
                    'status': "в работе",
                    'date': datetime.now().strftime("%d.%m.%Y"),
                    'entries': []
                }
                st.session_state.tasks[stage].append(new_task)
                st.session_state.editing_task = (i, len(st.session_state.tasks[stage]) - 1)
                st.rerun()
            st.markdown(" ", unsafe_allow_html=True)
            st.markdown(" ", unsafe_allow_html=True)
# === НОВАЯ ПАНЕЛЬ С ИТЕРАЦИЯМИ ВНИЗУ СТРАНИЦЫ ===
st.markdown('<div style="position: relative; min-height: 200px;">', unsafe_allow_html=True)
st.markdown("<h2 style='text-align: center; margin-bottom: 10px;'>Итерации</h2>", unsafe_allow_html=True)
for it in st.session_state.iterations:
    st.markdown(f"""
    <div style="position: absolute; top: {it['top']}px; left: {it['left']}px; width: {it['width']}px; height: 40px; background-color: {it['color']}; border-radius: 20px; text-align: center; line-height: 40px; color: white; font-weight: bold; opacity: 0.9;">
        {it['label']}
    </div>
    """, unsafe_allow_html=True)
st.markdown('</div>', unsafe_allow_html=True)
st.markdown(" ", unsafe_allow_html=True)