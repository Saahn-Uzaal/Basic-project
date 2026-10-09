package com.example.backend.task;

import com.example.backend.common.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class TaskService {

    private final TaskRepository repository;

    public TaskService(TaskRepository repository) {
        this.repository = repository;
    }

    public List<Task> findAll() {
        return repository.findAllByOrderByCreatedAtDesc();
    }

    public Task findById(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy task id=" + id));
    }

    @Transactional
    public Task create(TaskRequest request) {
        Task task = new Task();
        apply(task, request);
        return repository.save(task);
    }

    @Transactional
    public Task update(Long id, TaskRequest request) {
        Task task = findById(id);
        apply(task, request);
        return task;
    }

    @Transactional
    public void delete(Long id) {
        repository.delete(findById(id));
    }

    private static void apply(Task task, TaskRequest request) {
        task.setTitle(request.title().trim());
        task.setDescription(request.description());
        if (request.completed() != null) {
            task.setCompleted(request.completed());
        }
    }
}
