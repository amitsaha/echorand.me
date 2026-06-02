import torch
from torch import nn
from torch.utils.data import DataLoader
from torchvision import datasets
from torchvision.transforms import v2

from early_stopping import EarlyStopping

MAX_EPOCHS = 100

training_data = datasets.FashionMNIST(
    root="data",
    train=True,
    download=True,
    transform=v2.Compose([v2.ToImage(), v2.ToDtype(torch.float32, scale=True)]),
)

test_data = datasets.FashionMNIST(
    root="data",
    train=False,
    download=True,
    transform=v2.Compose([v2.ToImage(), v2.ToDtype(torch.float32, scale=True)]),
)

train_dataloader = DataLoader(training_data, batch_size=64)
test_dataloader = DataLoader(test_data, batch_size=64)


class NeuralNetwork(nn.Module):
    def __init__(self):
        super().__init__()
        self.flatten = nn.Flatten()
        self.linear_relu_stack = nn.Sequential(
            nn.Linear(28 * 28, 512),
            nn.ReLU(),
            nn.Linear(512, 512),
            nn.ReLU(),
            nn.Linear(512, 10),
        )

    def forward(self, x):
        x = self.flatten(x)
        logits = self.linear_relu_stack(x)
        return logits


def train_loop(dataloader, model, loss_fn, optimizer):

    model.train()

    running_loss = 0
    total_batches = len(dataloader)

    for batch, (X, y) in enumerate(dataloader):
        # Compute prediction and loss
        pred = model(X)
        loss = loss_fn(pred, y)

        # Backpropagation
        loss.backward()
        optimizer.step()
        optimizer.zero_grad()

        running_loss += loss.item()

        # val_acc, val_loss, val_auc, records = evaluate(
        #     model, val_loader, device, loss_criterion
        # )
    avg_loss = running_loss / total_batches
    return avg_loss


def test_loop(dataloader, model):

    model.eval()
    size = len(dataloader.dataset)
    num_batches = len(dataloader)
    test_loss, correct = 0, 0

    with torch.no_grad():
        for X, y in dataloader:
            pred = model(X)
            test_loss += criterion(pred, y).item()
            correct += (pred.argmax(1) == y).type(torch.float).sum().item()

    test_loss /= num_batches
    correct /= size
    print(
        f"Test Error: \n Accuracy: {(100 * correct):>0.1f}%, Avg loss: {test_loss:>8f} \n"
    )
    return test_loss


if __name__ == "__main__":
    model = NeuralNetwork()

    learning_rate = 1e-3
    batch_size = 64
    epochs = 5

    weight_ratio = torch.tensor([1] * 10, dtype=torch.float32)
    # criterion = nn.BCEWithLogitsLoss(pos_weight=weight_ratio)
    criterion = nn.CrossEntropyLoss(weight=weight_ratio)

    optimizer = torch.optim.SGD(model.parameters(), lr=learning_rate)

    early_stopping = EarlyStopping(
        patience=5, path="model.pth", class_weights=weight_ratio
    )
    for t in range(MAX_EPOCHS):
        train_loss = train_loop(train_dataloader, model, criterion, optimizer)
        test_loss = test_loop(test_dataloader, model)
        print(f"Epoch {t + 1} Train loss {train_loss} Test loss {test_loss}")
        early_stopping(test_loss, model)
        if early_stopping.early_stop:
            print("Early stopping triggered! Training halted.")
            break

    print("Done!")
